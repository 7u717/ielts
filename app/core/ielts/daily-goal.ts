// Discrete daily-goal stops. A saved value outside 10/20/30/40 stays selectable
// until the dictionary changes; nothing is rounded or migrated in storage.
export const STANDARD_DAILY_GOALS = [10, 20, 30, 40] as const
export const GOAL_RANGE_MIN = 0
export const GOAL_RANGE_STEP = 1
// A full remaining range should fit in a comfortable slide when the screen allows it.
export const HOLD_COMFORT_PX = 64

export function goalStops(legacy: number): number[] {
  const saved = Number(legacy)
  return [...new Set<number>([...STANDARD_DAILY_GOALS, saved])]
    .filter(n => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b)
}

export function goalRangeMax(count: number): number {
  return Math.max(0, count - 1)
}

export function uniformStep(stops: number[]): number {
  if (stops.length < 2) return 1
  const step = stops[1] - stops[0]
  if (!(step > 0)) return 1
  for (let i = 2; i < stops.length; i++) {
    if (stops[i] - stops[i - 1] !== step) return 1
  }
  return step
}

export function nearestStop(stops: number[], value: number): number {
  if (!stops.length || !Number.isFinite(value)) return stops[0] ?? 0
  let best = stops[0]
  let bestDist = Math.abs(value - best)
  for (const stop of stops) {
    const dist = Math.abs(value - stop)
    if (dist < bestDist || (dist === bestDist && stop > best)) {
      best = stop
      bestDist = dist
    }
  }
  return best
}

export function goalIndex(stops: number[], value: number): number {
  const exact = stops.indexOf(value)
  if (exact >= 0) return exact
  const nearest = nearestStop(stops, value)
  const index = stops.indexOf(nearest)
  return index < 0 ? 0 : index
}

// Empty and non-numeric text must not become 0. Number('') is 0, which would
// otherwise snap to the lowest stop and write it.
export function parseGoalEntry(raw: string): number | null {
  const text = raw.trim()
  if (!text || !/^[+-]?\d+(?:\.\d+)?$/.test(text)) return null
  const value = Number(text)
  return Number.isFinite(value) ? value : null
}

export interface HoldReach {
  originIndex: number
  originX: number
  originY: number
  x: number
  y: number
  viewportWidth: number
  viewportHeight: number
  count: number
}

function clampIndex(index: number, max: number) {
  return Math.max(0, Math.min(max, Math.round(index) || 0))
}

// Map one axis onto the stops that remain in that direction.
// The finger travel that represents the full remaining range is the smaller of
// a comfortable length and the pixels that actually exist before the screen edge,
// so a slide that reaches the edge always reaches the end of the range.
function alongAxis(origin: number, max: number, delta: number, roomDecrease: number, roomIncrease: number) {
  if (delta === 0) return origin
  const decreasing = delta < 0
  const steps = decreasing ? origin : max - origin
  const room = decreasing ? roomDecrease : roomIncrease
  if (steps <= 0 || room <= 0) return origin
  const span = Math.min(room, HOLD_COMFORT_PX * steps)
  const dead = span >= 48 ? 12 : 6
  const distance = Math.abs(delta)
  if (distance <= dead) return origin
  const usable = Math.max(1, span - dead)
  const t = Math.min(1, (distance - dead) / usable)
  const moved = Math.round(t * steps)
  return clampIndex(origin + (decreasing ? -moved : moved), max)
}

// Hold-slide from a point that may sit on the screen edge.
// Horizontal left/right keeps the slider metaphor. Vertical movement is the
// same value change on the axis that has room (down decreases, up increases),
// and the larger movement wins so a straight slide is not fought by the other axis.
// A zero move stays on the origin index.
export function indexFromReach(input: HoldReach): number {
  const max = Math.max(0, input.count - 1)
  const origin = clampIndex(input.originIndex, max)
  if (input.count <= 1) return origin
  if (!Number.isFinite(input.x) || !Number.isFinite(input.y)) return origin
  const dx = input.x - input.originX
  const dy = input.y - input.originY
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return origin
  const width = Math.max(0, input.viewportWidth)
  const height = Math.max(0, input.viewportHeight)
  const left = Math.max(0, Math.min(input.originX, width))
  const right = Math.max(0, width - input.originX)
  const up = Math.max(0, Math.min(input.originY, height))
  const down = Math.max(0, height - input.originY)
  const horizontal = alongAxis(origin, max, dx, left, right)
  // Positive Y is downward. Down has the open runway from a top avatar, so it
  // decreases; up increases. Passing -dy makes positive-down the decrease side
  // and gives that side the downward room.
  const vertical = alongAxis(origin, max, -dy, down, up)
  if (Math.abs(dx) >= Math.abs(dy)) return horizontal
  return vertical
}

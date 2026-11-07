// Discrete daily-goal stops. A saved value outside 10/20/30/40 stays selectable
// until the dictionary changes; nothing is rounded or migrated in storage.
export const STANDARD_DAILY_GOALS = [10, 20, 30, 40] as const
export const GOAL_RANGE_MIN = 0
export const GOAL_RANGE_STEP = 1

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

// Relative movement from the activation point. A zero delta keeps the origin,
// so the finger's absolute position cannot jump the value when the hold starts.
export function indexFromDelta(originIndex: number, deltaX: number, width: number, count: number): number {
  const max = Math.max(0, count - 1)
  const origin = Math.max(0, Math.min(max, Math.round(originIndex) || 0))
  if (count <= 1 || !(width > 0) || !Number.isFinite(deltaX)) return origin
  const steps = Math.round(deltaX / (width / max))
  return Math.max(0, Math.min(max, origin + steps))
}

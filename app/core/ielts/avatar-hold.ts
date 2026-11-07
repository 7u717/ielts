import { indexFromReach } from './daily-goal.ts'

export const HOLD_MS = 400
export const HOLD_SLOP = 10

export interface HoldGesture {
  phase: 'idle' | 'pending' | 'holding'
  pointerId: number
  startX: number
  startY: number
  originX: number
  originY: number
  lastX: number
  lastY: number
  viewportWidth: number
  viewportHeight: number
  originIndex: number
  draftIndex: number
  count: number
  // One-shot ghost-click guard for the gesture that just ended. The next
  // pointerdown replaces the gesture and clears it. Keyboard clicks are not
  // consulted against this flag by the component.
  suppressClick: boolean
}

export function createHoldGesture(): HoldGesture {
  return {
    phase: 'idle',
    pointerId: -1,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    lastX: 0,
    lastY: 0,
    viewportWidth: 0,
    viewportHeight: 0,
    originIndex: 0,
    draftIndex: 0,
    count: 1,
    suppressClick: false,
  }
}

function reachOf(gesture: HoldGesture, x: number, y: number) {
  return indexFromReach({
    originIndex: gesture.originIndex,
    originX: gesture.originX,
    originY: gesture.originY,
    x,
    y,
    viewportWidth: gesture.viewportWidth,
    viewportHeight: gesture.viewportHeight,
    count: gesture.count,
  })
}

export function holdPointerDown(
  current: HoldGesture,
  event: {
    pointerId: number
    x: number
    y: number
    isPrimary?: boolean
    index: number
    count: number
    viewportWidth: number
    viewportHeight: number
  }
): HoldGesture {
  // A second finger must not replace the active gesture or its origin.
  if (current.phase !== 'idle') return current
  if (event.isPrimary === false) return current
  return {
    ...createHoldGesture(),
    phase: 'pending',
    pointerId: event.pointerId,
    startX: event.x,
    startY: event.y,
    originX: event.x,
    originY: event.y,
    lastX: event.x,
    lastY: event.y,
    viewportWidth: event.viewportWidth,
    viewportHeight: event.viewportHeight,
    originIndex: event.index,
    draftIndex: event.index,
    count: Math.max(1, event.count),
  }
}

export function holdPointerMove(
  gesture: HoldGesture,
  event: { pointerId: number; x: number; y: number }
): { gesture: HoldGesture; scrollCancelled: boolean } {
  if (gesture.phase === 'idle' || event.pointerId !== gesture.pointerId) {
    return { gesture, scrollCancelled: false }
  }
  const tracked = { ...gesture, lastX: event.x, lastY: event.y }
  if (gesture.phase === 'pending') {
    const dx = event.x - gesture.startX
    const dy = event.y - gesture.startY
    if (Math.hypot(dx, dy) > HOLD_SLOP) {
      // The click that may follow this cancelled press is suppressed once.
      // A later pointerdown starts a fresh gesture, so the flag does not stick.
      return { gesture: { ...createHoldGesture(), suppressClick: true }, scrollCancelled: true }
    }
    return { gesture: tracked, scrollCancelled: false }
  }
  return {
    gesture: { ...tracked, draftIndex: reachOf(tracked, event.x, event.y) },
    scrollCancelled: false,
  }
}

// The activation point is the finger's position now, so earlier sub-slop
// movement is not applied and the value cannot jump.
export function holdActivate(
  gesture: HoldGesture,
  x: number,
  y: number,
  viewportWidth: number,
  viewportHeight: number
): HoldGesture {
  if (gesture.phase !== 'pending') return gesture
  return {
    ...gesture,
    phase: 'holding',
    originX: x,
    originY: y,
    lastX: x,
    lastY: y,
    viewportWidth,
    viewportHeight,
    draftIndex: gesture.originIndex,
    suppressClick: true,
  }
}

export function holdRelease(gesture: HoldGesture): { gesture: HoldGesture; commitIndex: number | null } {
  if (gesture.phase === 'holding') {
    return { gesture: { ...createHoldGesture(), suppressClick: true }, commitIndex: gesture.draftIndex }
  }
  if (gesture.phase === 'pending') return { gesture: createHoldGesture(), commitIndex: null }
  return { gesture, commitIndex: null }
}

// pointercancel does not produce a click on most phones. Leave suppressClick
// false so the next word, close, or keyboard activation is delivered.
// A ghost click, if one arrives before the next contact, is still ignored by
// the short-lived guard the component arms only when a click is expected.
export function holdCancel(gesture: HoldGesture): HoldGesture {
  if (gesture.phase === 'idle') return gesture
  return createHoldGesture()
}

export function holdConsumeClick(gesture: HoldGesture, detail = 1): { gesture: HoldGesture; suppressed: boolean } {
  // Keyboard activation reports detail 0. It is never part of the pointer gesture.
  if (detail === 0) return { gesture, suppressed: false }
  if (!gesture.suppressClick) return { gesture, suppressed: false }
  return { gesture: { ...gesture, suppressClick: false }, suppressed: true }
}

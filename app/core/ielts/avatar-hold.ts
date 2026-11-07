import { indexFromDelta } from './daily-goal.ts'

export const HOLD_MS = 400
export const HOLD_SLOP = 10

export interface HoldGesture {
  phase: 'idle' | 'pending' | 'holding'
  pointerId: number
  startX: number
  startY: number
  originX: number
  originIndex: number
  draftIndex: number
  width: number
  count: number
  suppressClick: boolean
}

export function createHoldGesture(): HoldGesture {
  return {
    phase: 'idle',
    pointerId: -1,
    startX: 0,
    startY: 0,
    originX: 0,
    originIndex: 0,
    draftIndex: 0,
    width: 0,
    count: 1,
    suppressClick: false,
  }
}

export function holdPointerDown(
  _current: HoldGesture,
  event: { pointerId: number; x: number; y: number; index: number; count: number }
): HoldGesture {
  return {
    ...createHoldGesture(),
    phase: 'pending',
    pointerId: event.pointerId,
    startX: event.x,
    startY: event.y,
    originX: event.x,
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
  if (gesture.phase === 'pending') {
    const dx = event.x - gesture.startX
    const dy = event.y - gesture.startY
    if (Math.hypot(dx, dy) > HOLD_SLOP) {
      return { gesture: { ...createHoldGesture(), suppressClick: true }, scrollCancelled: true }
    }
    return { gesture, scrollCancelled: false }
  }
  return {
    gesture: {
      ...gesture,
      draftIndex: indexFromDelta(gesture.originIndex, event.x - gesture.originX, gesture.width, gesture.count),
    },
    scrollCancelled: false,
  }
}

// Width may still be 0 here. The draft stays on the origin index either way.
export function holdActivate(gesture: HoldGesture, x: number, width: number): HoldGesture {
  if (gesture.phase !== 'pending') return gesture
  return {
    ...gesture,
    phase: 'holding',
    originX: x,
    width: width > 0 ? width : 0,
    draftIndex: gesture.originIndex,
    suppressClick: true,
  }
}

export function holdSetWidth(gesture: HoldGesture, width: number, x: number): HoldGesture {
  if (gesture.phase !== 'holding') return gesture
  const next = { ...gesture, width: width > 0 ? width : 0 }
  next.draftIndex = indexFromDelta(next.originIndex, x - next.originX, next.width, next.count)
  return next
}

export function holdRelease(gesture: HoldGesture): { gesture: HoldGesture; commitIndex: number | null } {
  if (gesture.phase === 'holding') {
    return { gesture: { ...createHoldGesture(), suppressClick: true }, commitIndex: gesture.draftIndex }
  }
  if (gesture.phase === 'pending') return { gesture: createHoldGesture(), commitIndex: null }
  return { gesture, commitIndex: null }
}

export function holdCancel(gesture: HoldGesture): HoldGesture {
  if (gesture.phase === 'idle') return gesture
  return { ...createHoldGesture(), suppressClick: true }
}

export function holdConsumeClick(gesture: HoldGesture): { gesture: HoldGesture; suppressed: boolean } {
  if (!gesture.suppressClick) return { gesture, suppressed: false }
  return { gesture: { ...gesture, suppressClick: false }, suppressed: true }
}

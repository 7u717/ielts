// Suppress only the click that belongs to a pointer gesture which just ended.
// Keyboard clicks (detail 0) are never suppressed. The arm expires, and the next
// independent contact clears it, so a touchcancel that produces no click cannot
// eat the following word, close, or keypress.
export function createClickSuppress(ttlMs = 450, schedule: typeof setTimeout = setTimeout, cancel: typeof clearTimeout = clearTimeout) {
  let armed = false
  let timer: ReturnType<typeof setTimeout> | undefined
  function disarm() {
    armed = false
    if (timer) cancel(timer)
    timer = undefined
  }
  return {
    arm() {
      armed = true
      if (timer) cancel(timer)
      timer = schedule(() => {
        armed = false
        timer = undefined
      }, ttlMs)
    },
    clear: disarm,
    shouldSuppress(event: { detail?: number }) {
      if ((event.detail ?? 0) === 0) return false
      if (!armed) return false
      disarm()
      return true
    },
    get armed() {
      return armed
    },
  }
}

export interface SheetDrag {
  pointerId: number
  startY: number
  drag: number
  tracking: boolean
}

export function idleSheetDrag(): SheetDrag {
  return { pointerId: -1, startY: 0, drag: 0, tracking: false }
}

export function sheetDragStart(state: SheetDrag, event: { pointerId: number; y: number; isPrimary?: boolean }, blocked: boolean): SheetDrag {
  if (blocked || event.isPrimary === false) return state
  if (state.tracking && event.pointerId !== state.pointerId) return state
  return { pointerId: event.pointerId, startY: event.y, drag: 0, tracking: true }
}

export function sheetDragMove(state: SheetDrag, event: { pointerId: number; y: number }): SheetDrag {
  if (!state.tracking || event.pointerId !== state.pointerId) return state
  return { ...state, drag: Math.max(0, event.y - state.startY) }
}

export function sheetDragFinish(
  state: SheetDrag,
  event: { pointerId: number },
  mode: 'up' | 'cancel'
): { state: SheetDrag; dismiss: boolean; suppressClick: boolean } {
  if (!state.tracking || event.pointerId !== state.pointerId) {
    return { state, dismiss: false, suppressClick: false }
  }
  const distance = state.drag
  const dismiss = mode === 'up' && distance > 65
  // Cancel has no click to swallow. Only a completed drag may suppress the click it generates.
  const suppressClick = mode === 'up' && distance > 8
  return { state: idleSheetDrag(), dismiss, suppressClick }
}

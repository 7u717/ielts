import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  GOAL_RANGE_MIN,
  GOAL_RANGE_STEP,
  goalIndex,
  goalRangeMax,
  goalStops,
  indexFromReach,
  nearestStop,
  parseGoalEntry,
  uniformStep,
} from './daily-goal.ts'
import {
  createHoldGesture,
  holdActivate,
  holdCancel,
  holdConsumeClick,
  holdPointerDown,
  holdPointerMove,
  holdPointerUp,
  holdRelease,
} from './avatar-hold.ts'

const phone = { viewportWidth: 390, viewportHeight: 844, count: 4 }
// Avatar sits at x 20–54, y 16–48. The finger starts at its centre.
const avatar = { x: 37, y: 32 }

describe('daily goal stops', () => {
  it('keeps the original 10/20/30/40 stops and a saved legacy value', () => {
    assert.deepEqual(goalStops(20), [10, 20, 30, 40])
    assert.deepEqual(goalStops(15), [10, 15, 20, 30, 40])
    assert.deepEqual(goalStops(5), [5, 10, 20, 30, 40])
    assert.equal(GOAL_RANGE_MIN, 0)
    assert.equal(GOAL_RANGE_STEP, 1)
    assert.equal(goalRangeMax(goalStops(20).length), 3)
    assert.equal(uniformStep(goalStops(20)), 10)
    assert.equal(uniformStep(goalStops(15)), 1)
  })

  it('snaps direct entry to the nearest stop without inventing values', () => {
    const stops = goalStops(15)
    assert.equal(nearestStop(stops, 15), 15)
    assert.equal(nearestStop(stops, 17), 15)
    assert.equal(nearestStop(stops, 25), 30)
    assert.equal(nearestStop(stops, 1), 10)
    assert.equal(nearestStop(stops, 99), 40)
    assert.equal(goalIndex(stops, 30), 3)
  })

  it('rejects empty and invalid goal text instead of treating it as zero', () => {
    assert.equal(parseGoalEntry(''), null)
    assert.equal(parseGoalEntry('   '), null)
    assert.equal(parseGoalEntry('abc'), null)
    assert.equal(parseGoalEntry('10px'), null)
    assert.equal(parseGoalEntry('30'), 30)
    assert.equal(parseGoalEntry(' 15 '), 15)
  })
})

describe('hold reach from the screen edge', () => {
  it('does not move when the finger has not moved', () => {
    assert.equal(indexFromReach({ ...phone, originIndex: 3, originX: avatar.x, originY: avatar.y, x: avatar.x, y: avatar.y }), 3)
    assert.equal(indexFromReach({ ...phone, originIndex: 3, originX: avatar.x, originY: avatar.y, x: avatar.x + 4, y: avatar.y + 2 }), 3)
  })

  it('reaches both ends of the range inside a 390px viewport', () => {
    const fromTop = { ...phone, originIndex: 3, originX: avatar.x, originY: avatar.y }
    assert.equal(indexFromReach({ ...fromTop, x: 0, y: avatar.y }), 0)
    assert.equal(indexFromReach({ ...fromTop, x: avatar.x, y: 32 + 200 }), 0)
    const fromBottom = { ...phone, originIndex: 0, originX: avatar.x, originY: avatar.y }
    assert.equal(indexFromReach({ ...fromBottom, x: 37 + 200, y: avatar.y }), 3)
    assert.equal(indexFromReach({ ...fromBottom, x: 370, y: avatar.y }), 3)
  })
})

describe('avatar hold', () => {
  it('does not jump when the hold activates on the avatar', () => {
    let gesture = holdPointerDown(createHoldGesture(), {
      pointerId: 1,
      x: avatar.x,
      y: avatar.y,
      isPrimary: true,
      index: 3,
      count: 4,
      viewportWidth: 390,
      viewportHeight: 844,
    })
    gesture = holdActivate(gesture, avatar.x, avatar.y, 390, 844)
    assert.equal(gesture.draftIndex, 3)
    const still = holdPointerMove(gesture, { pointerId: 1, x: avatar.x, y: avatar.y })
    assert.equal(still.gesture.draftIndex, 3)
  })

  it('cancels before the hold so a scroll is not captured', () => {
    const down = holdPointerDown(createHoldGesture(), {
      pointerId: 4,
      x: 20,
      y: 20,
      isPrimary: true,
      index: 1,
      count: 4,
      viewportWidth: 390,
      viewportHeight: 844,
    })
    const moved = holdPointerMove(down, { pointerId: 4, x: 22, y: 48 })
    assert.equal(moved.scrollCancelled, true)
    assert.equal(moved.gesture.phase, 'idle')
    const released = holdRelease(moved.gesture)
    assert.equal(released.commitIndex, null)
    const click = holdConsumeClick(moved.gesture, 1)
    assert.equal(click.suppressed, true)
  })

  it('commits on release and does not arm a click after pointercancel', () => {
    let gesture = holdPointerDown(createHoldGesture(), {
      pointerId: 2,
      x: avatar.x,
      y: avatar.y,
      isPrimary: true,
      index: 0,
      count: 4,
      viewportWidth: 390,
      viewportHeight: 844,
    })
    gesture = holdActivate(gesture, avatar.x, avatar.y, 390, 844)
    gesture = holdPointerMove(gesture, { pointerId: 2, x: avatar.x + 200, y: avatar.y }).gesture
    assert.equal(gesture.draftIndex, 3)
    const released = holdRelease(gesture)
    assert.equal(released.commitIndex, 3)
    assert.equal(holdConsumeClick(released.gesture, 1).suppressed, true)
    assert.equal(holdConsumeClick(released.gesture, 0).suppressed, false)

    let cancelled = holdPointerDown(createHoldGesture(), {
      pointerId: 3,
      x: avatar.x,
      y: avatar.y,
      isPrimary: true,
      index: 3,
      count: 4,
      viewportWidth: 390,
      viewportHeight: 844,
    })
    cancelled = holdActivate(cancelled, avatar.x, avatar.y, 390, 844)
    cancelled = holdPointerMove(cancelled, { pointerId: 3, x: avatar.x, y: avatar.y + 200 }).gesture
    cancelled = holdCancel(cancelled)
    assert.equal(cancelled.phase, 'idle')
    assert.equal(cancelled.suppressClick, false)
    assert.equal(holdPointerUp(cancelled, 3).commitIndex, null)
    assert.equal(holdConsumeClick(cancelled, 1).suppressed, false)
    assert.equal(holdConsumeClick(cancelled, 0).suppressed, false)
  })

  it('Escape or route cancel swallows only the trailing click', () => {
    const down = {
      pointerId: 1,
      x: 37,
      y: 32,
      isPrimary: true,
      index: 2,
      count: 4,
      viewportWidth: 390,
      viewportHeight: 844,
    }
    function active() {
      return holdActivate(holdPointerDown(createHoldGesture(), down), 37, 32, 390, 844)
    }
    for (const reason of ['explicit'] as const) {
      let gesture = holdPointerMove(active(), { pointerId: 1, x: 37, y: 240 }).gesture
      assert.notEqual(gesture.draftIndex, gesture.originIndex)
      gesture = holdCancel(gesture, reason)
      assert.equal(gesture.phase, 'idle')
      assert.equal(gesture.suppressClick, true)
      const released = holdPointerUp(gesture, 1)
      assert.equal(released.commitIndex, null)
      assert.equal(released.gesture.suppressClick, true)
      assert.equal(holdConsumeClick(released.gesture, 0).suppressed, false)
      assert.equal(released.gesture.suppressClick, true)
      const trailing = holdConsumeClick(released.gesture, 1)
      assert.equal(trailing.suppressed, true)
      const next = holdPointerDown(trailing.gesture, { ...down, pointerId: 4 })
      assert.equal(next.suppressClick, false)
      const tap = holdRelease(next)
      assert.equal(tap.commitIndex, null)
      assert.equal(holdConsumeClick(tap.gesture, 1).suppressed, false)
    }
  })

  it('ignores a second pointer without moving the origin or the draft', () => {
    let gesture = holdPointerDown(createHoldGesture(), {
      pointerId: 1,
      x: avatar.x,
      y: avatar.y,
      isPrimary: true,
      index: 3,
      count: 4,
      viewportWidth: 390,
      viewportHeight: 844,
    })
    gesture = holdActivate(gesture, avatar.x, avatar.y, 390, 844)
    const intruder = holdPointerDown(gesture, {
      pointerId: 2,
      x: 10,
      y: 700,
      isPrimary: false,
      index: 0,
      count: 4,
      viewportWidth: 390,
      viewportHeight: 844,
    })
    assert.equal(intruder.pointerId, 1)
    assert.equal(intruder.originX, avatar.x)
    const moved = holdPointerMove(intruder, { pointerId: 2, x: 8, y: 780 })
    assert.equal(moved.gesture.draftIndex, 3)
    assert.equal(moved.gesture.lastX, avatar.x)
    const up = holdRelease(moved.gesture)
    assert.equal(up.commitIndex, 3)
  })

  it('lets a plain tap through to the persistent controls', () => {
    const down = holdPointerDown(createHoldGesture(), {
      pointerId: 7,
      x: 5,
      y: 5,
      isPrimary: true,
      index: 0,
      count: 4,
      viewportWidth: 390,
      viewportHeight: 844,
    })
    const released = holdRelease(down)
    assert.equal(released.commitIndex, null)
    assert.equal(holdConsumeClick(released.gesture, 1).suppressed, false)
  })
})

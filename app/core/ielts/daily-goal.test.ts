import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  GOAL_RANGE_MIN,
  GOAL_RANGE_STEP,
  goalIndex,
  goalRangeMax,
  goalStops,
  indexFromDelta,
  nearestStop,
  uniformStep,
} from './daily-goal.ts'
import {
  createHoldGesture,
  holdActivate,
  holdCancel,
  holdConsumeClick,
  holdPointerDown,
  holdPointerMove,
  holdRelease,
  holdSetWidth,
} from './avatar-hold.ts'

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
})

describe('avatar hold', () => {
  it('does not jump when the hold activates away from the thumb', () => {
    let gesture = holdPointerDown(createHoldGesture(), { pointerId: 1, x: 12, y: 40, index: 2, count: 4 })
    gesture = holdActivate(gesture, 28, 0)
    assert.equal(gesture.draftIndex, 2)
    gesture = holdSetWidth(gesture, 240, 28)
    assert.equal(gesture.draftIndex, 2)
    const still = holdPointerMove(gesture, { pointerId: 1, x: 28, y: 40 })
    assert.equal(still.gesture.draftIndex, 2)
    const slid = holdPointerMove(gesture, { pointerId: 1, x: 28 + 80, y: 44 })
    assert.equal(slid.gesture.draftIndex, 3)
    const back = holdPointerMove(gesture, { pointerId: 1, x: 28 - 160, y: 40 })
    assert.equal(back.gesture.draftIndex, 0)
    const capped = holdPointerMove(gesture, { pointerId: 1, x: 28 + 800, y: 40 })
    assert.equal(capped.gesture.draftIndex, 3)
  })

  it('cancels before the hold so a scroll is not captured', () => {
    const down = holdPointerDown(createHoldGesture(), { pointerId: 4, x: 20, y: 20, index: 1, count: 4 })
    const moved = holdPointerMove(down, { pointerId: 4, x: 22, y: 48 })
    assert.equal(moved.scrollCancelled, true)
    assert.equal(moved.gesture.phase, 'idle')
    const released = holdRelease(moved.gesture)
    assert.equal(released.commitIndex, null)
    const click = holdConsumeClick(moved.gesture)
    assert.equal(click.suppressed, true)
  })

  it('commits on release and drops the value on pointercancel', () => {
    let gesture = holdPointerDown(createHoldGesture(), { pointerId: 2, x: 0, y: 0, index: 1, count: 4 })
    gesture = holdActivate(gesture, 0, 180)
    gesture = holdPointerMove(gesture, { pointerId: 2, x: 60, y: 2 }).gesture
    assert.equal(gesture.draftIndex, 2)
    const released = holdRelease(gesture)
    assert.equal(released.commitIndex, 2)
    assert.equal(released.gesture.phase, 'idle')
    assert.equal(holdConsumeClick(released.gesture).suppressed, true)

    let cancelled = holdPointerDown(createHoldGesture(), { pointerId: 3, x: 0, y: 0, index: 1, count: 4 })
    cancelled = holdActivate(cancelled, 0, 180)
    cancelled = holdPointerMove(cancelled, { pointerId: 3, x: 60, y: 0 }).gesture
    cancelled = holdCancel(cancelled)
    assert.equal(cancelled.phase, 'idle')
    assert.equal(holdRelease(cancelled).commitIndex, null)
  })

  it('lets a plain tap through to the persistent controls', () => {
    const down = holdPointerDown(createHoldGesture(), { pointerId: 7, x: 5, y: 5, index: 0, count: 4 })
    const released = holdRelease(down)
    assert.equal(released.commitIndex, null)
    assert.equal(holdConsumeClick(released.gesture).suppressed, false)
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Window } from 'happy-dom'
import { indexFromReach, parseGoalEntry } from './daily-goal.ts'
import {
  createHoldGesture,
  holdActivate,
  holdCancel,
  holdConsumeClick,
  holdPointerDown,
  holdPointerMove,
  holdRelease,
} from './avatar-hold.ts'
import { createClickSuppress, idleSheetDrag, sheetDragFinish, sheetDragMove, sheetDragStart } from './click-suppress.ts'
import { hitOwner } from './modal-owner.ts'

function phone() {
  const window = new Window({ url: 'http://localhost/', width: 390, height: 844, settings: { disableJavaScriptFileLoading: true } })
  const { document } = window
  // happy-dom opens dialogs but does not implement the :modal selector Chrome uses
  // after showModal(). Teach the test document that selector so the production check runs.
  const modal = new WeakSet<Element>()
  const proto = window.HTMLDialogElement.prototype
  const showModal = proto.showModal
  proto.showModal = function () {
    showModal.call(this)
    modal.add(this)
  }
  const close = proto.close
  proto.close = function (returnValue?: string) {
    modal.delete(this)
    close.call(this, returnValue)
  }
  const matches = proto.matches
  proto.matches = function (selectors: string) {
    if (selectors === ':modal') return modal.has(this)
    return matches.call(this, selectors)
  }
  document.body.innerHTML = ''
  return { window, document }
}

function laidOutBox(element: HTMLElement) {
  const rect = element.getBoundingClientRect()
  if (rect.width > 0 && rect.height > 0) return rect
  const left = parseFloat(element.style.left)
  const top = parseFloat(element.style.top)
  const width = parseFloat(element.style.width)
  const height = parseFloat(element.style.height)
  return { left, top, right: left + width, bottom: top + height, width, height, x: left, y: top }
}

describe('nested word detail dialog', () => {
  it('lets the first play and close clicks run and leaves the word list open', () => {
    const { window, document } = phone()
    const panel = document.createElement('div')
    panel.id = 'word-list'
    const word = document.createElement('button')
    word.textContent = 'biodiversity'
    panel.append(word)
    const dialog = document.createElement('dialog')
    const play = document.createElement('button')
    play.setAttribute('aria-label', '播放发音')
    play.textContent = 'play'
    const close = document.createElement('button')
    close.setAttribute('aria-label', '关闭')
    close.textContent = 'close'
    dialog.append(play, close)
    document.body.append(panel, dialog)
    dialog.showModal()

    let listClosed = false
    let played = 0
    let closed = 0
    const guard = createClickSuppress(450, window.setTimeout.bind(window), window.clearTimeout.bind(window))
    window.addEventListener(
      'pointerdown',
      event => {
        if (hitOwner(event.target, panel, document) !== 'outside') return
        guard.arm()
        event.preventDefault()
        event.stopPropagation()
        listClosed = true
      },
      true
    )
    window.addEventListener(
      'click',
      event => {
        if (!guard.shouldSuppress(event)) return
        event.preventDefault()
        event.stopPropagation()
      },
      true
    )
    play.addEventListener('click', () => {
      played += 1
    })
    close.addEventListener('click', () => {
      closed += 1
      dialog.close()
    })

    assert.equal(hitOwner(play, panel, document), 'dialog')
    play.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true }))
    play.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }))
    assert.equal(played, 1)
    assert.equal(listClosed, false)
    assert.equal(dialog.open, true)
    assert.equal(panel.isConnected, true)

    close.dispatchEvent(new window.PointerEvent('pointerdown', { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true }))
    close.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }))
    assert.equal(closed, 1)
    assert.equal(dialog.open, false)
    assert.equal(listClosed, false)
    assert.equal(panel.isConnected, true)
    window.close()
  })
})

describe('bidirectional hold on a 390px screen', () => {
  it('reads the avatar box and reaches 40 and 10 without leaving the viewport', () => {
    const { window, document } = phone()
    const avatar = document.createElement('button')
    avatar.style.position = 'fixed'
    avatar.style.left = '20px'
    avatar.style.top = '16px'
    avatar.style.width = '34px'
    avatar.style.height = '32px'
    document.body.append(avatar)
    const box = laidOutBox(avatar)
    assert.ok(box.left >= 20 && box.left <= 24, `avatar left ${box.left}`)
    assert.ok(box.right <= 54 && box.right >= 50, `avatar right ${box.right}`)
    const originX = box.left + box.width / 2
    const originY = box.top + box.height / 2
    assert.ok(originX >= 20 && originX <= 54)
    assert.ok(originY > 0 && originY < 80)

    const base = {
      originX,
      originY,
      viewportWidth: 390,
      viewportHeight: 844,
      count: 4,
    }
    assert.equal(indexFromReach({ ...base, originIndex: 3, x: originX, y: originY }), 3)
    assert.equal(indexFromReach({ ...base, originIndex: 3, x: 0, y: originY }), 0)
    assert.equal(indexFromReach({ ...base, originIndex: 3, x: originX, y: Math.min(844, originY + 220) }), 0)
    assert.equal(indexFromReach({ ...base, originIndex: 0, x: Math.min(389, originX + 220), y: originY }), 3)
    assert.ok(originX + 220 < 390)
    window.close()
  })
})

describe('multi-pointer and cancel lifecycle', () => {
  it('a second touch does not change the goal the first finger commits', () => {
    const { window } = phone()
    const view = { viewportWidth: window.innerWidth || 390, viewportHeight: window.innerHeight || 844 }
    let gesture = holdPointerDown(createHoldGesture(), {
      pointerId: 1,
      x: 37,
      y: 32,
      isPrimary: true,
      index: 3,
      count: 4,
      ...view,
    })
    gesture = holdActivate(gesture, 37, 32, view.viewportWidth, view.viewportHeight)
    const second = new window.PointerEvent('pointerdown', {
      bubbles: true,
      pointerId: 2,
      clientX: 12,
      clientY: 700,
      isPrimary: false,
      button: 0,
    })
    const afterSecond = holdPointerDown(gesture, {
      pointerId: second.pointerId,
      x: second.clientX,
      y: second.clientY,
      isPrimary: second.isPrimary,
      index: 0,
      count: 4,
      ...view,
    })
    assert.equal(afterSecond.originIndex, 3)
    const dragged = holdPointerMove(afterSecond, { pointerId: 2, x: 8, y: 800 })
    assert.equal(dragged.gesture.draftIndex, 3)
    const commit = holdRelease(dragged.gesture)
    assert.equal(commit.commitIndex, 3)
    window.close()
  })

  it('pointercancel without a click still allows the next tap and a keyboard click', () => {
    const { window, document } = phone()
    let gesture = holdPointerDown(createHoldGesture(), {
      pointerId: 1,
      x: 37,
      y: 32,
      isPrimary: true,
      index: 2,
      count: 4,
      viewportWidth: 390,
      viewportHeight: 844,
    })
    gesture = holdActivate(gesture, 37, 32, 390, 844)
    gesture = holdPointerMove(gesture, { pointerId: 1, x: 37, y: 240 }).gesture
    gesture = holdCancel(gesture)
    assert.equal(gesture.suppressClick, false)
    assert.equal(holdConsumeClick(gesture, 1).suppressed, false)

    const word = document.createElement('button')
    const close = document.createElement('button')
    document.body.append(word, close)
    let wordClicks = 0
    let keyClicks = 0
    word.addEventListener('click', () => {
      wordClicks += 1
    })
    close.addEventListener('click', () => {
      keyClicks += 1
    })
    word.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }))
    close.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 }))
    assert.equal(wordClicks, 1)
    assert.equal(keyClicks, 1)

    const guard = createClickSuppress(450, window.setTimeout.bind(window), window.clearTimeout.bind(window))
    guard.arm()
    const keyboard = new window.MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 })
    assert.equal(guard.shouldSuppress(keyboard), false)
    guard.clear()
    window.close()
  })

  it('a second finger on the sheet header does not dismiss', () => {
    let state = idleSheetDrag()
    state = sheetDragStart(state, { pointerId: 1, y: 100, isPrimary: true }, false)
    state = sheetDragMove(state, { pointerId: 1, y: 130 })
    const ignored = sheetDragStart(state, { pointerId: 2, y: 100, isPrimary: false }, false)
    assert.equal(ignored.pointerId, 1)
    const pulled = sheetDragMove(ignored, { pointerId: 2, y: 400 })
    assert.equal(pulled.drag, 30)
    const secondUp = sheetDragFinish(pulled, { pointerId: 2 }, 'up')
    assert.equal(secondUp.dismiss, false)
    assert.equal(secondUp.state.tracking, true)
    const cancel = sheetDragFinish(secondUp.state, { pointerId: 1 }, 'cancel')
    assert.equal(cancel.dismiss, false)
    assert.equal(cancel.suppressClick, false)
  })
})

describe('empty daily goal entry', () => {
  it('restores the field on change and does not commit', () => {
    const { window, document } = phone()
    const input = document.createElement('input')
    input.type = 'number'
    input.value = '30'
    document.body.append(input)
    const commits: number[] = []
    input.addEventListener('change', () => {
      const parsed = parseGoalEntry(input.value)
      if (parsed == null) {
        input.value = '30'
        return
      }
      commits.push(parsed)
    })
    input.value = ''
    input.dispatchEvent(new window.Event('change'))
    assert.equal(input.value, '30')
    assert.deepEqual(commits, [])
    assert.equal(parseGoalEntry(''), null)
    assert.equal(Number(''), 0)
    window.close()
  })
})

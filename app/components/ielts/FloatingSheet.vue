<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Icon from './Icon.vue'
import { haptic } from '@/core/ielts/ui'

const props = defineProps<{ open: boolean; title: string }>()
const emit = defineEmits<{ close: [] }>()
const panel = ref<HTMLElement>()
const bodyEl = ref<HTMLElement>()
const shown = ref(false)
const prep = ref(false)
const closing = ref(false)
const tracking = ref(false)
const drag = ref(0)
let timer = 0
let startY = 0
let previous: HTMLElement | null = null
let suppressClick = false
let swallowClick = false
let swallowTimer = 0
let bodyTrack: { id: number; x: number; y: number; armed: boolean } | null = null

function reduced() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
function finishClose() {
  shown.value = false
  closing.value = false
  prep.value = false
  drag.value = 0
  tracking.value = false
  bodyTrack = null
  document.documentElement.classList.remove('vocabulary-open')
  previous?.focus({ preventScroll: true })
  previous = null
}
function requestClose() {
  if (!shown.value || closing.value) return
  closing.value = true
  tracking.value = false
  window.clearTimeout(timer)
  timer = window.setTimeout(finishClose, reduced() ? 0 : 210)
  emit('close')
}
watch(
  () => props.open,
  async open => {
    if (open) {
      window.clearTimeout(timer)
      closing.value = false
      drag.value = 0
      tracking.value = false
      bodyTrack = null
      prep.value = true
      shown.value = true
      previous = document.activeElement as HTMLElement | null
      document.documentElement.classList.add('vocabulary-open')
      await nextTick()
      requestAnimationFrame(() => {
        prep.value = false
      })
      panel.value?.querySelector<HTMLElement>('.sheet-close')?.focus({ preventScroll: true })
    } else if (shown.value && !closing.value) {
      closing.value = true
      window.clearTimeout(timer)
      timer = window.setTimeout(finishClose, reduced() ? 0 : 210)
    }
  }
)
function endDrag(commit: boolean) {
  const distance = drag.value
  tracking.value = false
  bodyTrack = null
  if (distance > 8) suppressClick = true
  if (commit && distance > 65) {
    haptic()
    requestClose()
  } else drag.value = 0
}
function startDrag(event: PointerEvent) {
  if (closing.value || (event.target as HTMLElement).closest('button')) return
  tracking.value = true
  startY = event.clientY
  drag.value = 0
  try {
    ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
  } catch {
    /* The pointer can vanish between down and capture. */
  }
}
function moveDrag(event: PointerEvent) {
  if (!tracking.value) return
  drag.value = Math.max(0, event.clientY - startY)
}
function upDrag() {
  if (!tracking.value) return
  endDrag(true)
}
function cancelDrag() {
  if (!tracking.value) return
  endDrag(false)
}
function bodyDown(event: PointerEvent) {
  if (closing.value || tracking.value) return
  if ((bodyEl.value?.scrollTop || 0) > 0) return
  bodyTrack = { id: event.pointerId, x: event.clientX, y: event.clientY, armed: false }
}
function bodyMove(event: PointerEvent) {
  if (!bodyTrack || event.pointerId !== bodyTrack.id) return
  const dy = event.clientY - bodyTrack.y
  const dx = event.clientX - bodyTrack.x
  if (!bodyTrack.armed) {
    if (Math.abs(dy) < 8 && Math.abs(dx) < 8) return
    // Horizontal row actions and upward scrolling keep the pointer.
    if (dy < 10 || Math.abs(dx) > dy * 0.85 || (bodyEl.value?.scrollTop || 0) > 0) {
      bodyTrack = null
      return
    }
    bodyTrack.armed = true
    tracking.value = true
    startY = bodyTrack.y
    try {
      ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    } catch {
      /* Fall through; the gesture still updates from later moves. */
    }
  }
  drag.value = Math.max(0, event.clientY - startY)
}
function bodyUp(event: PointerEvent) {
  if (!bodyTrack || event.pointerId !== bodyTrack.id) return
  if (!bodyTrack.armed) {
    bodyTrack = null
    return
  }
  endDrag(true)
}
function bodyCancel(event: PointerEvent) {
  if (!bodyTrack || event.pointerId !== bodyTrack.id) return
  if (bodyTrack.armed) endDrag(false)
  else bodyTrack = null
}
function onClickCapture(event: MouseEvent) {
  if (!suppressClick) return
  suppressClick = false
  event.preventDefault()
  event.stopPropagation()
}
function focusables() {
  return [...(panel.value?.querySelectorAll<HTMLElement>('button, a, input, textarea, select') || [])].filter(
    el => !el.hasAttribute('disabled')
  )
}
function onKey(event: KeyboardEvent) {
  if (!shown.value || closing.value) return
  if (event.key === 'Escape') {
    event.preventDefault()
    requestClose()
    return
  }
  if (event.key !== 'Tab') return
  const nodes = focusables()
  if (!nodes.length || !panel.value) return
  const first = nodes[0]
  const last = nodes[nodes.length - 1]
  const active = document.activeElement
  if (event.shiftKey && (active === first || !panel.value.contains(active))) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}
function onOutside(event: PointerEvent) {
  if (!shown.value || closing.value || tracking.value) return
  const target = event.target as Node | null
  if (target && panel.value?.contains(target)) return
  swallowClick = true
  window.clearTimeout(swallowTimer)
  swallowTimer = window.setTimeout(() => {
    swallowClick = false
  }, 600)
  event.preventDefault()
  event.stopPropagation()
  requestClose()
}
function onSwallowClick(event: MouseEvent) {
  if (!swallowClick) return
  swallowClick = false
  window.clearTimeout(swallowTimer)
  event.preventDefault()
  event.stopPropagation()
}
onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('pointerdown', onOutside, true)
  window.addEventListener('click', onSwallowClick, true)
})
onBeforeUnmount(() => {
  window.clearTimeout(timer)
  window.clearTimeout(swallowTimer)
  document.documentElement.classList.remove('vocabulary-open')
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('pointerdown', onOutside, true)
  window.removeEventListener('click', onSwallowClick, true)
})
</script>
<template>
  <Teleport to="body">
    <div
      v-if="shown"
      ref="panel"
      class="floating-sheet vocabulary-sheet"
      :class="{ 'is-prep': prep, 'is-closing': closing, 'is-dragging': tracking }"
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      :style="{ '--sheet-drag': drag + 'px' }"
      @click.capture="onClickCapture"
    >
      <div class="sheet-frost" aria-hidden="true"></div>
      <div class="sheet-surface">
        <div
          class="sheet-grab"
          @pointerdown="startDrag"
          @pointermove="moveDrag"
          @pointerup="upDrag"
          @pointercancel="cancelDrag"
        >
          <i />
        </div>
        <div
          class="sheet-head"
          @pointerdown="startDrag"
          @pointermove="moveDrag"
          @pointerup="upDrag"
          @pointercancel="cancelDrag"
        >
          <h2>{{ title }}</h2>
          <button type="button" class="sheet-close" aria-label="关闭" @click="requestClose">
            <Icon name="close" />
          </button>
        </div>
        <div
          ref="bodyEl"
          class="sheet-body"
          @pointerdown="bodyDown"
          @pointermove="bodyMove"
          @pointerup="bodyUp"
          @pointercancel="bodyCancel"
        >
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>

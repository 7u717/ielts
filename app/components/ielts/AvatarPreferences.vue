<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useBaseStore } from '@/core/stores/base'
import { haptic, useIeltsUI } from '@/core/ielts/ui'
import { goalIndex } from '@/core/ielts/daily-goal'
import { useGoalStops } from '@/core/ielts/goal-stops'
import {
  HOLD_MS,
  createHoldGesture,
  holdActivate,
  holdCancel,
  holdConsumeClick,
  holdPointerDown,
  holdPointerMove,
  holdRelease,
  holdSetWidth,
  type HoldGesture,
} from '@/core/ielts/avatar-hold'
import { withAppBaseURL } from '@/core/utils/base-url'
import Preferences from './Preferences.vue'

const props = withDefaults(defineProps<{ enabled?: boolean; anchor?: 'start' | 'end' }>(), {
  enabled: true,
  anchor: 'start',
})
const store = useBaseStore()
const { preferencesOpen, topicsOpen } = useIeltsUI()
const { stops } = useGoalStops()
const button = ref<HTMLButtonElement>()
const panel = ref<HTMLElement>()
const gesture = ref<HoldGesture>(createHoldGesture())
const holding = computed(() => gesture.value.phase === 'holding')
const visible = computed(() => preferencesOpen.value || holding.value)
const draftGoal = computed(() => stops.value[gesture.value.draftIndex] ?? store.sdict.perDayStudyNumber)
let timer = 0
let lastX = 0
let listening = false
let swallowClick = false
let swallowTimer = 0

function currentIndex() {
  return goalIndex(stops.value, store.sdict.perDayStudyNumber)
}
function stopListening() {
  if (!listening) return
  listening = false
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
  window.removeEventListener('pointercancel', onPointerCancel)
}
function startListening() {
  if (listening) return
  listening = true
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  window.addEventListener('pointercancel', onPointerCancel)
}
function releaseCapture(event: PointerEvent) {
  const el = button.value
  if (el?.hasPointerCapture?.(event.pointerId)) {
    try {
      el.releasePointerCapture(event.pointerId)
    } catch {
      /* Already released. */
    }
  }
}
function clearHoldChrome() {
  if (button.value) button.value.style.touchAction = ''
}
function measureWidth(x: number) {
  const dial = panel.value?.querySelector('.goal-dial') as HTMLElement | null
  const width = dial?.getBoundingClientRect().width || 0
  gesture.value = holdSetWidth(gesture.value, width || 220, x)
}
function onPointerDown(event: PointerEvent) {
  if (!props.enabled || event.button !== 0) return
  lastX = event.clientX
  window.clearTimeout(timer)
  gesture.value = holdPointerDown(gesture.value, {
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    index: currentIndex(),
    count: stops.value.length,
  })
  startListening()
  const pointerId = event.pointerId
  const target = event.currentTarget as HTMLElement
  timer = window.setTimeout(() => {
    if (gesture.value.phase !== 'pending' || gesture.value.pointerId !== pointerId) return
    gesture.value = holdActivate(gesture.value, lastX, 0)
    preferencesOpen.value = false
    topicsOpen.value = false
    haptic()
    if (button.value) button.value.style.touchAction = 'none'
    try {
      target.setPointerCapture(pointerId)
    } catch {
      /* Pointer may already be gone. */
    }
    void nextTick(() => requestAnimationFrame(() => measureWidth(lastX)))
  }, HOLD_MS)
}
function onPointerMove(event: PointerEvent) {
  lastX = event.clientX
  const result = holdPointerMove(gesture.value, { pointerId: event.pointerId, x: event.clientX, y: event.clientY })
  gesture.value = result.gesture
  if (gesture.value.phase === 'holding' && event.cancelable) event.preventDefault()
  if (result.scrollCancelled) {
    window.clearTimeout(timer)
    clearHoldChrome()
    stopListening()
  }
}
function onPointerUp(event: PointerEvent) {
  if (gesture.value.phase === 'idle' || event.pointerId !== gesture.value.pointerId) return
  window.clearTimeout(timer)
  const result = holdRelease(gesture.value)
  if (result.commitIndex != null) {
    const goal = stops.value[result.commitIndex]
    if (goal && goal !== store.sdict.perDayStudyNumber) {
      store.sdict.perDayStudyNumber = goal
      haptic()
    }
  }
  gesture.value = result.gesture
  releaseCapture(event)
  clearHoldChrome()
  stopListening()
}
function onPointerCancel(event: PointerEvent) {
  if (gesture.value.phase === 'idle' || event.pointerId !== gesture.value.pointerId) return
  window.clearTimeout(timer)
  gesture.value = holdCancel(gesture.value)
  releaseCapture(event)
  clearHoldChrome()
  stopListening()
}
function onClick(event: MouseEvent) {
  const result = holdConsumeClick(gesture.value)
  gesture.value = result.gesture
  if (result.suppressed) {
    event.preventDefault()
    event.stopPropagation()
    return
  }
  preferencesOpen.value = !preferencesOpen.value
  if (preferencesOpen.value) topicsOpen.value = false
}
function closePersistent() {
  if (gesture.value.phase !== 'idle') {
    window.clearTimeout(timer)
    gesture.value = holdCancel(gesture.value)
    clearHoldChrome()
    stopListening()
  }
  preferencesOpen.value = false
}
function onKey(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !visible.value) return
  event.preventDefault()
  closePersistent()
}
function onOutside(event: PointerEvent) {
  if (!preferencesOpen.value || holding.value) return
  const target = event.target as HTMLElement | null
  if (!target?.closest) return
  if (target.closest('.avatar-glass, .avatar-button, [data-open-preferences]')) return
  preferencesOpen.value = false
  swallowClick = true
  window.clearTimeout(swallowTimer)
  swallowTimer = window.setTimeout(() => {
    swallowClick = false
  }, 600)
  event.preventDefault()
  event.stopPropagation()
}
function onSwallowClick(event: MouseEvent) {
  if (!swallowClick) return
  swallowClick = false
  window.clearTimeout(swallowTimer)
  event.preventDefault()
  event.stopPropagation()
}
function focusReturn() {
  const target = button.value ?? (document.querySelector('[data-open-preferences]') as HTMLElement | null)
  target?.focus({ preventScroll: true })
}
watch(
  () => preferencesOpen.value && !holding.value,
  async open => {
    if (!open) return
    await nextTick()
    panel.value?.focus({ preventScroll: true })
  }
)
watch(preferencesOpen, (open, was) => {
  if (!open && was && !holding.value) void nextTick(() => focusReturn())
})
watch(topicsOpen, open => {
  if (open) preferencesOpen.value = false
})
const route = useRoute()
watch(
  () => route.path,
  () => closePersistent()
)
onMounted(() => {
  window.addEventListener('keydown', onKey)
  window.addEventListener('pointerdown', onOutside, true)
  window.addEventListener('click', onSwallowClick, true)
})
onBeforeUnmount(() => {
  window.clearTimeout(timer)
  window.clearTimeout(swallowTimer)
  if (gesture.value.phase !== 'idle') gesture.value = holdCancel(gesture.value)
  clearHoldChrome()
  stopListening()
  window.removeEventListener('keydown', onKey)
  window.removeEventListener('pointerdown', onOutside, true)
  window.removeEventListener('click', onSwallowClick, true)
})
</script>
<template>
  <button
    v-if="enabled"
    ref="button"
    type="button"
    class="avatar-button"
    :class="{ 'is-holding': holding }"
    aria-label="偏好设置"
    aria-haspopup="dialog"
    aria-controls="preference-popover"
    :aria-expanded="visible"
    :data-phase="gesture.phase"
    @pointerdown="onPointerDown"
    @click="onClick"
    @contextmenu.prevent
    @dragstart.prevent
  >
    <img :src="withAppBaseURL('/imgs/profile-avatar.jpg')" alt="" draggable="false" />
  </button>
  <Teleport to="body">
    <Transition name="avatar-pop">
      <div
        v-if="visible"
        id="preference-popover"
        ref="panel"
        class="avatar-glass"
        :class="{ holding, 'anchor-end': anchor === 'end' }"
        role="dialog"
        aria-label="偏好"
        tabindex="-1"
        :data-holding="holding ? 'true' : 'false'"
        @keydown="onKey"
      >
        <Preferences :preview="holding ? draftGoal : null" :locked="holding" />
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import Icon from './Icon.vue'
import { haptic } from '@/core/ielts/ui'
const props = defineProps<{
  open: boolean
  title: string
  minimal?: boolean
  floating?: boolean
  draggable?: boolean
  origin?: { x: number; y: number }
}>()
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement>()
const closing = ref(false)
const entered = ref(false)
const drag = ref(0)
const sourceOffset = ref({ x: 0, y: 0 })
let previous: HTMLElement | null = null
let timer: ReturnType<typeof setTimeout> | undefined
let startY = 0
const tracking = ref(false)
let disposed = false
function finishClose(notify: boolean) {
  dialog.value?.close()
  closing.value = false
  drag.value = 0
  previous?.focus({ preventScroll: true })
  if (notify) emit('close')
}
function beginClose(notify = false) {
  if (closing.value || !dialog.value?.open) return
  closing.value = true
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  timer = setTimeout(() => finishClose(notify), reduced ? 0 : 200)
}
function close() {
  beginClose(true)
}
watch(
  () => props.open,
  async open => {
    await nextTick()
    if (disposed) return
    if (open) {
      clearTimeout(timer)
      entered.value = false
      closing.value = false
      drag.value = 0
      previous = document.activeElement as HTMLElement
      if (!dialog.value?.open) {
        haptic()
        dialog.value?.showModal()
      }
      if (props.origin && dialog.value) {
        const element = dialog.value
        sourceOffset.value = {
          x: props.origin.x - element.offsetLeft - element.offsetWidth / 2,
          y: props.origin.y - element.offsetTop - element.offsetHeight / 2,
        }
      }
    } else {
      beginClose()
    }
  },
  { immediate: true }
)
function animationEnd(event: AnimationEvent) {
  if (!event.pseudoElement && !closing.value) entered.value = true
}
function down(e: PointerEvent) {
  if ((e.target as HTMLElement).closest('button, input, textarea, a, [role=button]')) return
  entered.value = true
  startY = e.clientY
  tracking.value = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function move(e: PointerEvent) {
  if (tracking.value) {
    const distance = Math.max(0, e.clientY - startY)
    drag.value = distance / (1 + distance / 360)
  }
}
function cancelDrag() {
  tracking.value = false
  drag.value = 0
}
function up() {
  if (!tracking.value) return
  tracking.value = false
  if (drag.value > 65) {
    haptic()
    void close()
  } else drag.value = 0
}
onBeforeUnmount(() => {
  disposed = true
  clearTimeout(timer)
  dialog.value?.close()
})
</script>
<template>
  <dialog
    ref="dialog"
    class="ielts-sheet"
    :class="{
      'sheet-closing': closing,
      'sheet-dragging': tracking,
      'preference-sheet': minimal,
      'floating-sheet': floating,
      'sheet-entered': entered,
      'source-sheet': !!origin,
    }"
    :aria-label="title"
    :style="{ '--sheet-drag': drag + 'px', '--source-x': sourceOffset.x + 'px', '--source-y': sourceOffset.y + 'px' }"
    @animationend.self="animationEnd"
    @cancel.prevent="close"
    @click="
      e => {
        if (e.target === dialog) close()
      }
    "
  >
    <div
      class="sheet-surface"
      @pointerdown="props.draggable && down($event)"
      @pointermove="props.draggable && move($event)"
      @pointerup="props.draggable && up()"
      @pointercancel="props.draggable && cancelDrag()"
    >
      <div
        class="sheet-grab"
        @pointerdown.stop="down"
        @pointermove.stop="move"
        @pointerup.stop="up"
        @pointercancel.stop="cancelDrag"
      >
        <i />
      </div>
      <div v-if="!minimal" class="sheet-head">
        <h2>{{ title }}</h2>
        <button class="icon-button" aria-label="关闭" @click="close">
          <Icon name="close" />
        </button>
      </div>
      <slot name="heading" />
      <div class="sheet-body"><slot /></div>
    </div>
  </dialog>
</template>

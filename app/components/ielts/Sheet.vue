<script setup lang="ts">
import { ref, watch, nextTick, onBeforeUnmount } from 'vue'
import Icon from './Icon.vue'
import { haptic } from '@/core/ielts/ui'
const props = defineProps<{ open: boolean; title: string }>()
const emit = defineEmits<{ close: [] }>()
const dialog = ref<HTMLDialogElement>()
const closing = ref(false)
const drag = ref(0)
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
  timer = setTimeout(() => finishClose(notify), reduced ? 0 : 180)
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
      closing.value = false
      drag.value = 0
      previous = document.activeElement as HTMLElement
      if (!dialog.value?.open) dialog.value?.showModal()
    } else {
      beginClose()
    }
  },
  { immediate: true }
)
function down(e: PointerEvent) {
  startY = e.clientY
  tracking.value = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function move(e: PointerEvent) {
  if (tracking.value) drag.value = Math.max(0, e.clientY - startY)
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
    }"
    :aria-label="title"
    :style="{ '--sheet-drag': drag + 'px' }"
    @cancel.prevent="close"
    @click="
      e => {
        if (e.target === dialog) close()
      }
    "
  >
    <div class="sheet-surface">
      <div class="sheet-grab" @pointerdown="down" @pointermove="move" @pointerup="up" @pointercancel="up"><i /></div>
      <div class="sheet-head">
        <h2>{{ title }}</h2>
        <button class="icon-button" aria-label="关闭" @click="close">
          <Icon name="close" />
        </button>
      </div>
      <div class="sheet-body"><slot /></div>
    </div>
  </dialog>
</template>

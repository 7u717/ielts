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
let tracking = false
let disposed = false
async function close() {
  if (closing.value || !props.open) return
  closing.value = true
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  timer = setTimeout(
    () => {
      emit('close')
      closing.value = false
      drag.value = 0
    },
    reduced ? 0 : 180
  )
}
watch(
  () => props.open,
  async open => {
    await nextTick()
    if (disposed) return
    if (open) {
      closing.value = false
      drag.value = 0
      previous = document.activeElement as HTMLElement
      if (!dialog.value?.open) dialog.value?.showModal()
    } else {
      dialog.value?.close()
      previous?.focus({ preventScroll: true })
    }
  },
  { immediate: true }
)
function down(e: PointerEvent) {
  startY = e.clientY
  tracking = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function move(e: PointerEvent) {
  if (tracking) drag.value = Math.max(0, e.clientY - startY)
}
function up() {
  if (!tracking) return
  tracking = false
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
    :class="{ 'sheet-closing': closing, 'sheet-dragging': tracking }"
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
        <button class="icon-button" aria-label="关闭" @click="close"><Icon name="close" /></button>
      </div>
      <div class="sheet-body"><slot /></div>
    </div>
  </dialog>
</template>

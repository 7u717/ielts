<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import Ring from './Ring.vue'
import { haptic } from '@/core/ielts/ui'
const props = defineProps<{ name: string; progress: number; selected: boolean; disabled?: boolean; active: boolean }>()
const emit = defineEmits<{ select: [] }>()
const preview = ref(false)
let hold: ReturnType<typeof setTimeout> | undefined
let dismiss: ReturnType<typeof setTimeout> | undefined
let select: ReturnType<typeof setTimeout> | undefined
let x = 0,
  y = 0,
  held = false,
  moved = false
function down(e: PointerEvent) {
  clearTimeout(dismiss)
  clearTimeout(hold)
  x = e.clientX
  y = e.clientY
  held = false
  moved = false
  preview.value = true
  hold = setTimeout(() => {
    held = true
    haptic()
  }, 350)
}
function move(e: PointerEvent) {
  if (Math.hypot(e.clientX - x, e.clientY - y) > 9) {
    moved = true
    clearTimeout(hold)
    preview.value = false
  }
}
function release() {
  clearTimeout(hold)
  dismiss = setTimeout(() => {
    preview.value = false
  }, 900)
}
function cancel() {
  moved = true
  clearTimeout(hold)
  preview.value = false
}
function choose() {
  if (held || moved || props.disabled) return
  preview.value = true
  clearTimeout(select)
  select = setTimeout(() => emit('select'), 120)
}
watch(
  () => props.active,
  active => {
    if (!active) {
      clearTimeout(hold)
      clearTimeout(dismiss)
      clearTimeout(select)
      preview.value = false
    }
  }
)
onBeforeUnmount(() => {
  clearTimeout(hold)
  clearTimeout(dismiss)
  clearTimeout(select)
})
</script>
<template>
  <button
    class="topic-row"
    :aria-label="name"
    :aria-pressed="selected"
    :disabled="disabled"
    @pointerdown="down"
    @pointermove="move"
    @pointerup="release"
    @pointercancel="cancel"
    @contextmenu.prevent
    @click="choose"
    @blur="preview = false"
  >
    <Ring :progress="progress" :size="34" small>
      <Transition name="topic-peek"
        ><span v-if="preview" class="topic-peek" role="status">{{ Math.round(progress * 100) }}<small>%</small></span
        ><i v-else-if="selected" class="topic-current-dot"
      /></Transition>
    </Ring>
    <span>{{ name }}</span>
  </button>
</template>

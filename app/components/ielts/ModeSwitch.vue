<script setup lang="ts">
import { computed, ref } from 'vue'
import { WordPracticeMode } from '@/core/types/enum'
import { haptic } from '@/core/ielts/ui'
import Icon from './Icon.vue'
const props = defineProps<{ modelValue: WordPracticeMode; disabled?: boolean; vocabularyLabel: string }>()
const emit = defineEmits<{ 'update:modelValue': [WordPracticeMode]; vocabulary: [] }>()
const modes = [
  { id: WordPracticeMode.System, label: '学习', icon: 'learn' },
  { id: WordPracticeMode.Free, label: '打字', icon: 'keyboard' },
  { id: WordPracticeMode.ListenOnly, label: '听写', icon: 'headphones' },
]
const index = computed(() =>
  Math.max(
    0,
    modes.findIndex(m => m.id === props.modelValue)
  )
)
const bar = ref<HTMLElement>()
const offset = ref<number | null>(null)
let tracking = false,
  origin = 0
function choose(value: WordPracticeMode) {
  if (!props.disabled && value !== props.modelValue) {
    haptic()
    emit('update:modelValue', value)
  }
}
function selectSegment(segment: number) {
  if (props.disabled) return
  if (segment === 3) {
    haptic()
    emit('vocabulary')
  } else choose(modes[segment].id)
}
function down(e: PointerEvent) {
  if (props.disabled || !e.isPrimary) return
  tracking = true
  origin = e.clientX
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function move(e: PointerEvent) {
  if (!tracking) return
  if (Math.abs(e.clientX - origin) > 5) {
    offset.value = Math.max(0, Math.min(162, e.clientX - bar.value!.getBoundingClientRect().left - 31))
  }
}
function up(e: PointerEvent) {
  if (!tracking) return
  selectSegment(Math.max(0, Math.min(3, Math.floor((e.clientX - bar.value!.getBoundingClientRect().left - 4) / 54))))
  tracking = false
  offset.value = null
}
function cancel() {
  tracking = false
  offset.value = null
}
</script>
<template>
  <div
    ref="bar"
    class="mode-switch"
    role="group"
    aria-label="学习模式"
    data-horizontal
    @pointerdown.stop="down"
    @pointermove="move"
    @pointerup.stop="up"
    @pointercancel="cancel"
    @keydown.right.prevent="choose(modes[(index + 1) % 3].id)"
    @keydown.left.prevent="choose(modes[(index + 2) % 3].id)"
  >
    <i
      class="mode-indicator"
      :class="{ dragging: offset !== null }"
      :style="{ transform: `translateX(${offset ?? index * 54}px)` }"
    />
    <button
      v-for="m in modes"
      :key="m.id"
      type="button"
      :aria-label="m.label"
      :aria-pressed="modelValue === m.id"
      :disabled="disabled"
      @click="choose(m.id)"
    >
      <Icon :name="m.icon" />
    </button>
    <button
      class="vocabulary-entry-button"
      type="button"
      :aria-label="vocabularyLabel"
      aria-haspopup="dialog"
      :disabled="disabled"
      @click="selectSegment(3)"
    >
      <Icon name="list" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { WordPracticeMode } from '@/core/types/enum'
import { haptic, type IeltsTab } from '@/core/ielts/ui'
import Icon from './Icon.vue'
const props = defineProps<{ tab: IeltsTab; mode: WordPracticeMode; disabled: boolean; vocabularyLabel: string }>()
const emit = defineEmits<{ tab: [IeltsTab]; mode: [WordPracticeMode]; vocabulary: [] }>()
const items = [
  { label: '学习', icon: 'learn' },
  { label: '打字', icon: 'keyboard' },
  { label: '听写', icon: 'headphones' },
  { label: '', icon: 'list' },
  { label: '错词', icon: 'wrong' },
  { label: '复习', icon: 'review' },
]
const modes = [WordPracticeMode.System, WordPracticeMode.Free, WordPracticeMode.ListenOnly]
const active = computed(() =>
  props.tab === 'wrong' ? 4 : props.tab === 'review' ? 5 : Math.max(0, modes.indexOf(props.mode))
)
const bar = ref<HTMLElement>()
const offset = ref<number | null>(null)
let start = 0,
  tracking = false
function select(index: number) {
  if (props.disabled) return
  haptic()
  if (index === 3) emit('vocabulary')
  else if (index > 3) emit('tab', index === 4 ? 'wrong' : 'review')
  else {
    emit('tab', 'learn')
    emit('mode', modes[index])
  }
}
function down(e: PointerEvent) {
  if (!e.isPrimary || props.disabled) return
  tracking = true
  start = e.clientX
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function move(e: PointerEvent) {
  if (tracking && Math.abs(e.clientX - start) > 5)
    offset.value = Math.max(0, Math.min(5, (e.clientX - bar.value!.getBoundingClientRect().left - 5) / 54 - 0.5))
}
function up(e: PointerEvent) {
  if (!tracking) return
  select(Math.max(0, Math.min(5, Math.floor((e.clientX - bar.value!.getBoundingClientRect().left - 5) / 54))))
  cancel()
}
function cancel() {
  tracking = false
  offset.value = null
}
</script>
<template>
  <nav
    ref="bar"
    class="iue-tabs unified-dock"
    aria-label="学习导航"
    data-horizontal
    @pointerdown.stop="down"
    @pointermove="move"
    @pointerup.stop="up"
    @pointercancel="cancel"
    @keydown.right.prevent="select((active + 1) % 6)"
    @keydown.left.prevent="select((active + 5) % 6)"
  >
    <i
      class="tab-indicator"
      :class="{ dragging: offset !== null }"
      :style="{ transform: `translateX(${(offset ?? active) * 54}px)` }"
    />
    <button
      v-for="(item, index) in items"
      :key="index"
      :id="index === 4 ? 'tab-wrong' : index === 5 ? 'tab-review' : index === 0 ? 'tab-learn' : undefined"
      :aria-label="item.label || vocabularyLabel"
      :aria-pressed="active === index"
      :disabled="disabled"
      :aria-haspopup="index === 3 ? 'dialog' : undefined"
      @click="select(index)"
    >
      <Icon :name="item.icon" />
    </button>
  </nav>
</template>

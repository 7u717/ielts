<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { WordPracticeMode } from '@/core/types/enum'
import { haptic, type IeltsTab } from '@/core/ielts/ui'
import Icon from './Icon.vue'
const props = defineProps<{ tab: IeltsTab; mode: WordPracticeMode; disabled: boolean; vocabularyLabel: string }>()
const emit = defineEmits<{ tab: [IeltsTab]; mode: [WordPracticeMode]; vocabulary: [] }>()
const items = [
  { label: '学习', icon: 'learn' },
  { label: '', icon: 'list' },
  { label: '错词', icon: 'wrong' },
  { label: '复习', icon: 'review' },
]
const active = computed(() => (props.tab === 'wrong' ? 2 : props.tab === 'review' ? 3 : 0))
const bar = ref<HTMLElement>()
const modeMenu = ref<HTMLElement>()
const modeOpen = ref(false)
const modeChoices = [
  { id: WordPracticeMode.System, label: '学习', icon: 'learn' },
  { id: WordPracticeMode.Free, label: '打字', icon: 'keyboard' },
  { id: WordPracticeMode.ListenOnly, label: '听写', icon: 'headphones' },
]
let skipClick = false
function chooseMode(mode: WordPracticeMode) {
  modeOpen.value = false
  haptic()
  emit('mode', mode)
}
function outside(event: PointerEvent) {
  if (!bar.value?.contains(event.target as Node) && !modeMenu.value?.contains(event.target as Node))
    modeOpen.value = false
}
function key(event: KeyboardEvent) {
  if (event.key === 'Escape') modeOpen.value = false
}
onMounted(() => {
  document.addEventListener('pointerdown', outside)
  document.addEventListener('keydown', key)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', outside)
  document.removeEventListener('keydown', key)
})
function click(event: MouseEvent, index: number) {
  if (event.detail !== 0 && skipClick) {
    skipClick = false
    return
  }
  skipClick = false
  select(index)
}
const offset = ref<number | null>(null)
let start = 0,
  tracking = false
function select(index: number) {
  if (props.disabled) return
  haptic()
  if (index === 0 && props.tab === 'learn') {
    modeOpen.value = !modeOpen.value
    return
  }
  modeOpen.value = false
  if (index === 1) emit('vocabulary')
  else emit('tab', index === 2 ? 'wrong' : index === 3 ? 'review' : 'learn')
}
function down(e: PointerEvent) {
  if (!e.isPrimary || props.disabled) return
  skipClick = false
  tracking = true
  start = e.clientX
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function move(e: PointerEvent) {
  if (tracking && Math.abs(e.clientX - start) > 5)
    offset.value = Math.max(0, Math.min(3, (e.clientX - bar.value!.getBoundingClientRect().left - 5) / 64 - 0.5))
}
function up(e: PointerEvent) {
  if (!tracking) return
  select(Math.max(0, Math.min(3, Math.floor((e.clientX - bar.value!.getBoundingClientRect().left - 5) / 64))))
  skipClick = true
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
    @keydown.right.prevent="select((active + 1) % 4)"
    @keydown.left.prevent="select((active + 3) % 4)"
  >
    <i
      class="tab-indicator"
      :class="{ dragging: offset !== null }"
      :style="{ transform: `translateX(${(offset ?? active) * 64}px)` }"
    />
    <button
      v-for="(item, index) in items"
      :key="index"
      :id="index === 2 ? 'tab-wrong' : index === 3 ? 'tab-review' : index === 0 ? 'tab-learn' : undefined"
      :aria-label="item.label || vocabularyLabel"
      :aria-pressed="active === index"
      :disabled="disabled"
      :aria-haspopup="index === 1 ? 'dialog' : index === 0 ? 'menu' : undefined"
      :aria-expanded="index === 0 ? modeOpen : undefined"
      @click="click($event, index)"
    >
      <Icon :name="item.icon" />
    </button>
  </nav>
  <Transition name="dock-modes">
    <div
      v-if="modeOpen"
      ref="modeMenu"
      class="dock-mode-menu"
      role="menu"
      aria-label="学习模式"
      data-horizontal
      @pointerdown.stop
    >
      <button
        v-for="choice in modeChoices"
        :key="choice.id"
        role="menuitemradio"
        :aria-label="choice.label + '模式'"
        :aria-checked="mode === choice.id"
        :aria-pressed="mode === choice.id"
        :disabled="disabled"
        @click="chooseMode(choice.id)"
      >
        <Icon :name="choice.icon" />
      </button>
    </div>
  </Transition>
</template>

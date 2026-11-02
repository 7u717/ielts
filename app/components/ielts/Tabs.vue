<script setup lang="ts">
import { computed, ref } from 'vue'
import Icon from './Icon.vue'
import { haptic, type IeltsTab } from '@/core/ielts/ui'
const props = defineProps<{ modelValue: IeltsTab }>()
const emit = defineEmits<{ 'update:modelValue': [IeltsTab] }>()
const tabs = [
  { id: 'learn', name: '学习', icon: 'learn' },
  { id: 'wrong', name: '错词', icon: 'wrong' },
  { id: 'review', name: '复习', icon: 'review' },
] as const
const index = computed(() => tabs.findIndex(t => t.id === props.modelValue))
const dragging = ref(false)
const dragX = ref<number | null>(null)
const bar = ref<HTMLElement>()
let start = 0
function cancelDrag() {
  dragging.value = false
  dragX.value = null
}
function choose(id: IeltsTab) {
  if (id !== props.modelValue) {
    haptic()
    emit('update:modelValue', id)
  }
}
function down(e: PointerEvent) {
  start = e.clientX
  dragging.value = true
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function move(e: PointerEvent) {
  if (dragging.value && Math.abs(e.clientX - start) > 4)
    dragX.value = Math.max(0, Math.min(128, e.clientX - bar.value!.getBoundingClientRect().left - 36))
}
function up(e: PointerEvent) {
  if (!dragging.value) return
  dragging.value = false
  const local = e.clientX - bar.value!.getBoundingClientRect().left - 5
  choose(tabs[Math.max(0, Math.min(2, Math.floor(local / 64)))].id)
  dragX.value = null
}
</script>
<template>
  <nav
    ref="bar"
    class="iue-tabs"
    role="tablist"
    aria-label="学习导航"
    @pointerdown="down"
    @pointermove="move"
    @pointerup="up"
    @pointercancel="cancelDrag"
    @keydown.right.prevent="choose(tabs[(index + 1) % 3].id)"
    @keydown.left.prevent="choose(tabs[(index + 2) % 3].id)"
  >
    <i
      class="tab-indicator"
      :class="{ dragging: dragX !== null }"
      :style="{ transform: `translateX(${dragX ?? index * 64}px)` }"
    />
    <button
      v-for="t in tabs"
      :key="t.id"
      :id="'tab-' + t.id"
      role="tab"
      :aria-label="t.name"
      :aria-selected="modelValue === t.id"
      :aria-controls="'panel-' + t.id"
      @click="choose(t.id)"
    >
      <Icon :name="t.icon" />
    </button>
  </nav>
</template>

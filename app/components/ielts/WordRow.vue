<script setup lang="ts">
import { ref } from 'vue'
import type { Word } from '@/core/types'
import Icon from './Icon.vue'
import { haptic } from '@/core/ielts/ui'
defineProps<{ word: Word; removable?: boolean }>()
const emit = defineEmits<{ open: [Word]; remove: [Word] }>()
const offset = ref(0)
let x = 0,
  y = 0,
  swiped = false,
  active = false
function cancel() {
  offset.value = 0
  active = false
}
function down(e: PointerEvent) {
  x = e.clientX
  y = e.clientY
  active = true
  swiped = false
}
function move(e: PointerEvent) {
  if (active && Math.abs(e.clientX - x) > Math.abs(e.clientY - y) + 12) {
    offset.value = Math.min(0, Math.max(-90, e.clientX - x))
    swiped = offset.value < -12
  }
}
function up(e: PointerEvent, word: Word, removable?: boolean) {
  active = false
  if (swiped && removable) {
    e.stopPropagation()
    if (offset.value < -64) {
      haptic()
      emit('remove', word)
    }
  }
  offset.value = 0
}
</script>
<template>
  <div
    class="word-row-wrap"
    @pointerdown="down"
    @pointermove="move"
    @pointerup="up($event, word, removable)"
    @pointercancel="cancel"
  >
    <span v-if="removable" class="row-remove" aria-hidden="true"><Icon name="remove" /></span>
    <button
      class="word-row"
      :style="{ transform: `translateX(${removable ? offset : 0}px)` }"
      @click="!swiped && emit('open', word)"
      @pointerdown="haptic"
    >
      <span>{{ word.word }}</span
      ><span class="row-meaning">{{ word.trans.map(t => t.cn).join('；') }}</span>
    </button>
  </div>
</template>

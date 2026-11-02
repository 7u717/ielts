<script setup lang="ts">
import { ref, computed, nextTick, watch, onBeforeUnmount } from 'vue'
import { practiceExamples } from '@/core/ielts/examples'
import type { Word } from '@/core/types'
import { usePlayWordAudio } from '@/core/hooks/sound'
import { haptic } from '@/core/ielts/ui'
import Icon from './Icon.vue'
const props = defineProps<{ words: Word[]; open: boolean }>()
const speak = usePlayWordAudio()
const detail = ref<Word | null>(null)
const popup = ref<HTMLDialogElement>()
const examples = computed(() => (detail.value ? practiceExamples(detail.value).slice(0, 2) : []))
const closing = ref(false)
let closeTimer: ReturnType<typeof setTimeout> | undefined
let hold: ReturnType<typeof setTimeout> | undefined
let held = false,
  moved = false,
  startX = 0,
  startY = 0,
  suppressClick = false
async function show(word: Word) {
  haptic()
  clearTimeout(closeTimer)
  closing.value = false
  detail.value = word
  await nextTick()
  if (props.open && !popup.value?.open) popup.value?.showModal()
}
function tap(word: Word) {
  if (suppressClick) {
    suppressClick = false
    return
  }
  haptic()
  speak(word.word)
  void show(word)
}
function down(event: PointerEvent) {
  if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return
  startX = event.clientX
  startY = event.clientY
  held = moved = suppressClick = false
  hold = setTimeout(() => {
    held = true
    haptic()
  }, 440)
}
function move(event: PointerEvent) {
  if (Math.hypot(event.clientX - startX, event.clientY - startY) > 9) {
    moved = true
    clearTimeout(hold)
  }
}
function up(word: Word) {
  clearTimeout(hold)
  if (held && !moved) {
    suppressClick = true
    speak(word.word) // Playback stays in the release gesture, never in the hold timer.
    void show(word)
  } else if (moved) suppressClick = true
}
function cancel() {
  clearTimeout(hold)
  held = false
  suppressClick = true
}
function close() {
  if (!popup.value?.open || closing.value) return
  closing.value = true
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  closeTimer = setTimeout(
    () => {
      popup.value?.close()
      closing.value = false
    },
    reduced ? 0 : 200
  )
}
watch(
  () => props.open,
  () => {
    cancel()
    close()
  }
)
onBeforeUnmount(() => {
  clearTimeout(hold)
  clearTimeout(closeTimer)
  popup.value?.close()
})
</script>
<template>
  <div class="vocabulary-list" :class="{ 'vocabulary-visible': open }">
    <div
      v-for="(word, index) in words"
      :key="word.word"
      class="vocabulary-entry"
      :style="{ '--entry-delay': Math.min(index, 8) * 25 + 'ms' }"
    >
      <button
        type="button"
        class="vocabulary-word"
        :aria-label="word.word"
        :aria-expanded="detail?.word === word.word && !closing"
        aria-haspopup="dialog"
        aria-controls="vocabulary-word-detail"
        @pointerdown="down"
        @pointermove="move"
        @pointerup="up(word)"
        @pointercancel="cancel"
        @contextmenu.prevent
        @click="tap(word)"
      >
        <span class="vocabulary-english">{{ word.word }}</span>
        <span class="vocabulary-gloss" aria-hidden="true">{{ word.trans.map(t => t.cn).join('；') }}</span>
      </button>
    </div>
    <dialog
      ref="popup"
      id="vocabulary-word-detail"
      class="vocabulary-detail"
      :class="{ 'vocabulary-closing': closing }"
      @cancel.prevent="close"
      :aria-label="detail?.word || '单词详情'"
      @close="detail = null"
      @click="
        e => {
          if (e.target === popup) close()
        }
      "
    >
      <div v-if="detail" class="vocabulary-detail-content">
        <button class="vocabulary-detail-word" aria-label="播放发音" @click="speak(detail.word)">
          {{ detail.word }}
          <Icon name="sound" />
        </button>
        <p class="vocabulary-detail-meaning">
          <span v-for="(translation, index) in detail.trans" :key="index"
            ><small v-if="translation.pos">{{ translation.pos }}</small
            >{{ translation.cn }}<br v-if="index < detail.trans.length - 1"
          /></span>
        </p>
        <div v-for="sentence in examples" :key="sentence.c" class="vocabulary-example">
          <p>{{ sentence.c }}</p>
          <p v-if="sentence.cn">{{ sentence.cn }}</p>
        </div>
      </div>
    </dialog>
  </div>
</template>

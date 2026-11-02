<script setup lang="ts">
import { ref, nextTick, watch, onBeforeUnmount } from 'vue'
import type { Word } from '@/core/types'
import { usePlayWordAudio } from '@/core/hooks/sound'
import { haptic } from '@/core/ielts/ui'
import Icon from './Icon.vue'
const props = defineProps<{ words: Word[]; open: boolean }>()
const speak = usePlayWordAudio()
const detail = ref<Word | null>(null)
const popup = ref<HTMLDialogElement>()
const lastWord = ref('')
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
  lastWord.value = lastWord.value === word.word ? '' : word.word
  if (lastWord.value) speak(word.word)
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
    lastWord.value = word.word
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
    lastWord.value = ''
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
        :aria-expanded="lastWord === word.word"
        :aria-controls="'vocab-' + word.id"
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
      <div
        :id="'vocab-' + word.id"
        class="vocabulary-expansion"
        :class="{ expanded: lastWord === word.word }"
        :aria-hidden="lastWord !== word.word"
        :inert="lastWord !== word.word"
      >
        <div>
          <div class="vocabulary-inline-detail">
            <p>{{ word.trans.map(t => (t.pos ? t.pos + ' ' : '') + t.cn).join('；') }}</p>
            <button class="icon-button" :aria-label="'播放 ' + word.word + ' 发音'" @click="speak(word.word)">
              <Icon name="sound" />
            </button>
          </div>
        </div>
      </div>
    </div>
    <dialog
      ref="popup"
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
        </button>
        <p class="vocabulary-detail-meaning">
          <span v-for="(translation, index) in detail.trans" :key="index"
            ><small v-if="translation.pos">{{ translation.pos }}</small
            >{{ translation.cn }}<br v-if="index < detail.trans.length - 1"
          /></span>
        </p>
        <div v-for="sentence in detail.sentences?.slice(0, 2)" :key="sentence.c" class="vocabulary-example">
          <p>{{ sentence.c }}</p>
          <p>{{ sentence.cn }}</p>
        </div>
      </div>
    </dialog>
  </div>
</template>

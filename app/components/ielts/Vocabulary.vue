<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { practiceExamples } from '@/core/ielts/examples'
import type { Word } from '@/core/types'
import { usePlayWordAudio } from '@/core/hooks/sound'
import { useBaseStore } from '@/core/stores/base'
import { haptic } from '@/core/ielts/ui'
import Icon from './Icon.vue'
import Sheet from './Sheet.vue'
import { britishPhonetic } from '@/core/ielts/phonetics'
const props = defineProps<{ words: Word[]; open: boolean }>()
const speak = usePlayWordAudio()
const store = useBaseStore()
const mastered = (word: Word) =>
  store.knownWordsSet.has(word.word.toLowerCase()) || store.simpleWords.includes(word.word.toLowerCase())
const detail = ref<Word | null>(null)
function mastery(word: Word) {
  if (mastered(word)) return 'mastered'
  const card = store.fsrsData[word.word]
  if (card && card.reps > 0) return card.stability >= 7 ? 'mastered' : 'learning'
  const index = store.sdict.words.findIndex(item => item.word === word.word)
  return index >= 0 && (store.sdict.complete || index < store.sdict.lastLearnIndex) ? 'learning' : 'new'
}
const phonetic = computed(() => (detail.value ? britishPhonetic(detail.value) : ''))
const detailSize = computed(() => Math.min(30, 240 / Math.max(1, (detail.value?.word.length || 1) * 0.58)))
const examples = computed(() => (detail.value ? practiceExamples(detail.value).slice(0, 2) : []))
const pressed = ref('')
let hold: ReturnType<typeof setTimeout> | undefined
let held = false,
  moved = false,
  startX = 0,
  startY = 0,
  suppressClick = false
function show(word: Word) {
  detail.value = word
}
function tap(word: Word, event: MouseEvent) {
  if (suppressClick) {
    suppressClick = false
    return
  }
  if (event.detail === 0) haptic()
  speak(word.word)
  void show(word)
}
function down(word: Word, event: PointerEvent) {
  if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return
  pressed.value = word.word
  haptic()
  startX = event.clientX
  startY = event.clientY
  held = moved = suppressClick = false
  hold = setTimeout(() => {
    held = true
    pressed.value = ''
    suppressClick = true
    haptic()
    show(word)
  }, 440)
}
function move(event: PointerEvent) {
  if (Math.hypot(event.clientX - startX, event.clientY - startY) > 9) {
    pressed.value = ''
    moved = true
    clearTimeout(hold)
  }
}
function up(word: Word) {
  pressed.value = ''
  clearTimeout(hold)
  if (held && !moved) {
    suppressClick = true
    speak(word.word) // Playback stays in the release gesture, never in the hold timer.
    void show(word)
  } else if (moved) suppressClick = true
}
function cancel() {
  pressed.value = ''
  clearTimeout(hold)
  held = false
  suppressClick = true
}
watch(
  () => props.open,
  () => {
    cancel()
    detail.value = null
  }
)
onBeforeUnmount(() => {
  clearTimeout(hold)
})
</script>
<template>
  <div class="vocabulary-list" :class="{ 'vocabulary-visible': open }">
    <div
      v-for="(word, index) in words"
      :key="word.word"
      class="vocabulary-entry"
      :style="{ '--entry-delay': Math.min(index, 8) * 20 + 'ms' }"
    >
      <button
        type="button"
        class="vocabulary-word"
        :class="{ 'is-pressed': pressed === word.word }"
        :aria-label="word.word"
        :aria-expanded="detail?.word === word.word"
        aria-haspopup="dialog"
        aria-controls="vocabulary-word-detail"
        @pointerdown="down(word, $event)"
        @pointermove="move"
        @pointerup="up(word)"
        @pointercancel="cancel"
        @contextmenu.prevent
        @click="tap(word, $event)"
      >
        <i
          class="mastery-dot"
          :class="'mastery-' + mastery(word)"
          :aria-label="mastery(word) === 'mastered' ? '已掌握' : mastery(word) === 'learning' ? '学习中' : '未学习'"
        />
        <span class="vocabulary-english">{{ word.word }}</span>
        <span class="vocabulary-gloss" aria-hidden="true">{{ word.trans.map(t => t.cn).join('；') }}</span>
      </button>
    </div>
    <Sheet
      :open="!!detail && open"
      :title="detail?.word || '单词详情'"
      minimal
      floating
      draggable
      id="vocabulary-word-detail"
      class="word-detail-sheet vocabulary-word-sheet"
      @close="detail = null"
    >
      <template v-if="detail">
        <div class="detail-word-heading">
          <h2 :style="{ fontSize: detailSize + 'px' }">{{ detail.word }}</h2>
          <div class="detail-sound-row">
            <span v-if="phonetic" class="detail-phonetic">/{{ phonetic }}/</span>
            <button class="icon-button" aria-label="播放发音" @click="speak(detail.word)"><Icon name="sound" /></button>
          </div>
        </div>
        <p class="detail-meaning">{{ detail.trans.map(t => [t.pos, t.cn].filter(Boolean).join(' ')).join('；') }}</p>
        <div class="word-examples">
          <div v-for="sentence in examples" :key="sentence.c">
            <p>{{ sentence.c }}</p>
            <p v-if="sentence.cn" class="sheet-note">{{ sentence.cn }}</p>
          </div>
        </div>
      </template>
    </Sheet>
  </div>
</template>

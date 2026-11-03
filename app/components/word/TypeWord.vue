<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { britishPhonetic } from '@/core/ielts/phonetics'
import { practiceExamples } from '@/core/ielts/examples'
import { useWindowSize } from '@vueuse/core'
import type { Question, Word } from '@/core/types'
import { WordPlayTrigger, WordPracticeType, WordPracticeMode, ShortcutKey } from '@/core/types/enum'
import { useBaseStore } from '@/core/stores/base'
import { useSettingStore } from '@/core/stores/setting'
import { usePlayWordAudio, cancelWordPracticeAudio } from '@/core/hooks/sound'
import { useInjectedDisplayPolicy } from '@/core/composables/practice-words/usePracticeDisplayPolicy'
import { usePracticeTypeWordController } from '@/core/composables/practice-words/usePracticeTypeWordController'
import { EventKey, useEvents } from '@/core/utils/eventBus'
import { useWordOptions } from '@/core/hooks/dict'
import { focusPracticeKeyboard, haptic } from '@/core/ielts/ui'
import WordTypingCore from './WordTypingCore.vue'
import Footer from './Footer.vue'
import Sheet from '@/components/ielts/Sheet.vue'
import Icon from '@/components/ielts/Icon.vue'
const props = defineProps<{
  word: Word
  question?: Question | null
  practiceType: WordPracticeType
  phaseKey: string
}>()
const emit = defineEmits<{
  complete: []
  wrong: [source?: 'identifyTyping']
  know: []
  mastered: []
  skip: []
  toggleSimple: []
  quickMark: []
}>()
const store = useBaseStore()
const settings = useSettingStore()
const minimalInput = computed(() =>
  [WordPracticeMode.Free, WordPracticeMode.ListenOnly].includes(settings.wordPracticeMode)
)
const detailsOpen = ref(false)
const detailRevealed = ref(false)
const meaning = ref(false)
const note = ref('')
const editing = ref(false)
const bookmarkBounce = ref(false)
function toggleCollection() {
  haptic()
  toggleWordCollect(props.word)
  bookmarkBounce.value = isWordCollect(props.word)
}
const typing = ref<InstanceType<typeof WordTypingCore>>()
const speak = usePlayWordAudio()
const { isWordCollect, toggleWordCollect } = useWordOptions()
const controller = usePracticeTypeWordController({
  getWord: () => props.word,
  getPracticeType: () => props.practiceType,
  getPhaseKey: () => props.phaseKey,
  getIsWordMasked: () => effective.value.isWordMasked,
  getAutoPlayFirstSentence: () => false,
  onWrong: () => emit('wrong'),
  playWordAudio: (word, manual, onEnd) => speak(word, manual, onEnd),
  playFirstSentence: () => {},
})
const effective = useInjectedDisplayPolicy(
  computed(() => ({ showFullWord: controller.showFullWord.value, showWordResult: controller.showWordResult.value }))
)
const { width } = useWindowSize({ initialWidth: 390 })
const glyphWidth = ref(Math.max(1, props.word.word.length * 0.56))
let measurementCanvas: HTMLCanvasElement | undefined
let disposed = false
function measureWord() {
  if (import.meta.server || disposed) return
  measurementCanvas ??= document.createElement('canvas')
  const context = measurementCanvas.getContext('2d')
  if (!context) return
  const family = getComputedStyle(document.documentElement).getPropertyValue('--r-num').trim()
  context.font = `400 100px ${family || '-apple-system, sans-serif'}`
  glyphWidth.value = Math.max(1, context.measureText(props.word.word).width / 100)
}
watch([() => props.word.word, width], measureWord, { immediate: true })
const size = computed(() => Math.min(48, (Math.min(500, Math.min(width.value, 600) - 64) - 2) / glyphWidth.value))
const detailSize = computed(() => Math.min(30, (Math.min(width.value - 64, 310) - 52) / glyphWidth.value))
const phonetic = computed(() => britishPhonetic(props.word))
const examples = computed(() => practiceExamples(props.word))
const examplePreview = computed(() =>
  !minimalInput.value && !effective.value.isWordMasked ? examples.value[0]?.c : ''
)
const dragX = ref(0)
const dragging = ref(false)
const phaseName = computed(
  () =>
    ({
      [WordPracticeType.FollowWrite]: '跟写',
      [WordPracticeType.Listen]: '听写',
      [WordPracticeType.Dictation]: '默写',
      [WordPracticeType.Identify]: '回想',
      [WordPracticeType.Spell]: '拼写',
    })[props.practiceType] || ''
)
function play(trigger = WordPlayTrigger.Manual) {
  if (trigger !== WordPlayTrigger.Manual && !settings.wordSound) return
  if (trigger === WordPlayTrigger.Manual) haptic()
  controller.playWord(trigger)
}
function openDetails() {
  haptic()
  if (!detailRevealed.value) controller.checkMaskedRevealWrong(!!typing.value?.isWordRight())
  detailRevealed.value = true
  detailsOpen.value = true
}
function tapWord() {
  play()
  meaning.value = true
  openDetails()
}
function onWrong() {
  haptic()
  emit('wrong', props.practiceType === WordPracticeType.Identify ? 'identifyTyping' : undefined)
}
const flying = ref(false)
const threshold = 86
let thresholdPassed = false
let pressedWord = false
let skipWordClick = false
let flightTimer: ReturnType<typeof setTimeout> | undefined
function decide(direction: number) {
  if (flying.value) return
  haptic()
  flying.value = true
  dragging.value = false
  dragX.value = direction * Math.max(width.value * 1.15, 430)
  flightTimer = setTimeout(() => {
    if (direction > 0) emit('know')
    else onWrong()
    emit('complete')
  }, 220)
}
function wordClick(event: MouseEvent) {
  if (suppressClick || (skipWordClick && event.isTrusted)) {
    skipWordClick = suppressClick = false
    return
  }
  skipWordClick = false
  tapWord()
}
let startX = 0,
  startY = 0,
  moved = false,
  suppressClick = false
let hold: ReturnType<typeof setTimeout> | undefined
let finishTimer: ReturnType<typeof setTimeout> | undefined
function down(e: PointerEvent) {
  if (flying.value || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return
  if ((e.target as HTMLElement).closest('button, input, textarea, a')) return
  pressedWord = !!(e.target as HTMLElement).closest('#word-wrap')
  thresholdPassed = false
  dragging.value = true
  skipWordClick = false
  dragX.value = 0
  startX = e.clientX
  startY = e.clientY
  moved = false
  suppressClick = false
  ;((e.target as HTMLElement).closest('#word-wrap') || (e.currentTarget as HTMLElement)).setPointerCapture(e.pointerId)
  if (pressedWord)
    hold = setTimeout(() => {
      suppressClick = true
      haptic()
    }, 420)
}
function move(e: PointerEvent) {
  if (!dragging.value) return
  const dx = e.clientX - startX,
    dy = e.clientY - startY
  if (Math.abs(dx) > Math.abs(dy) * 1.2) dragX.value = Math.max(-300, Math.min(300, dx))
  if (Math.abs(dragX.value) > threshold && !thresholdPassed) {
    haptic()
    thresholdPassed = true
  }
  if (Math.abs(dragX.value) < threshold) thresholdPassed = false
  if (Math.hypot(e.clientX - startX, e.clientY - startY) > 9) {
    moved = true
    clearTimeout(hold)
  }
}
function up(e: PointerEvent) {
  if (!dragging.value) return
  clearTimeout(hold)
  dragging.value = false
  if (moved && Math.abs(dragX.value) > threshold) {
    suppressClick = true
    skipWordClick = true
    decide(dragX.value > 0 ? 1 : -1)
    return
  }
  dragX.value = 0
  if (suppressClick && !moved) {
    skipWordClick = true
    play()
    return
  }
  if (!moved && pressedWord && e.pointerType !== 'mouse') {
    tapWord()
    skipWordClick = true
  } else if (moved) suppressClick = true
}
function cancel() {
  dragging.value = false
  dragX.value = 0
  clearTimeout(hold)
  suppressClick = true
}
watch(
  [() => props.word.word, () => props.phaseKey],
  () => {
    clearTimeout(hold)
    clearTimeout(finishTimer)
    clearTimeout(flightTimer)
    flying.value = false
    dragX.value = 0
    dragging.value = false
    cancelWordPracticeAudio()
    controller.reset()
    editing.value = false
    detailRevealed.value = false
    meaning.value = props.practiceType === WordPracticeType.FollowWrite
  },
  { immediate: true }
)
watch(
  () => settings.wordSound,
  enabled => {
    if (enabled) play(WordPlayTrigger.NewWord)
    else cancelWordPracticeAudio()
  }
)
function resumeAudio() {
  if (!document.hidden && settings.wordSound) play(WordPlayTrigger.NewWord)
}
onMounted(() => {
  measureWord()
  void document.fonts?.ready.then(measureWord)
  document.addEventListener('visibilitychange', resumeAudio)
})
onBeforeUnmount(() => {
  disposed = true
  document.removeEventListener('visibilitychange', resumeAudio)
  clearTimeout(hold)
  clearTimeout(finishTimer)
  clearTimeout(flightTimer)
  cancelWordPracticeAudio()
})
useEvents([
  [EventKey.resetWord, controller.reset],
  [ShortcutKey.PlayWordPronunciation, () => play()],
  [ShortcutKey.ShowWord, tapWord],
])
function closeDetails() {
  bookmarkBounce.value = false
  detailsOpen.value = false
  editing.value = false
}
function editNote() {
  note.value = store.noteData[props.word.word] || ''
  editing.value = true
}
function saveNote() {
  if (note.value.trim()) store.noteData[props.word.word] = note.value.trim()
  else delete store.noteData[props.word.word]
  editing.value = false
}
</script>
<template>
  <div v-if="word.word" class="typing-word" :class="{ 'minimal-input': minimalInput }" :data-practice-phase="phaseName">
    <Transition name="word-change" mode="out-in">
      <div :key="word.word + phaseKey" class="word-stage">
        <i class="next-card-echo" aria-hidden="true" />
        <div
          class="word-swipe-surface"
          :class="{ dragging, flying }"
          @pointerdown="down"
          @pointermove="move"
          @pointerup="up"
          @pointercancel="cancel"
          :style="{
            '--word-drag': dragX + 'px',
            '--word-turn': Math.max(-12, Math.min(12, dragX / 30)) + 'deg',
            opacity: flying ? 0 : 1 - Math.min(0.3, Math.abs(dragX) / 700),
          }"
        >
          <div
            id="word-wrap"
            class="practice-word-target"
            role="button"
            tabindex="0"
            aria-label="单词，点按详情，长按发音，左滑跳过"
            :style="{ fontSize: size + 'px' }"
            @click="wordClick"
            @keydown.enter.prevent="tapWord"
            @keydown.space.prevent="play()"
            @contextmenu.prevent
          >
            <WordTypingCore
              ref="typing"
              :word="word"
              :active="!detailsOpen && !editing"
              :minimalInput="minimalInput"
              :practiceType="practiceType"
              :isWordMasked="effective.isWordMasked"
              :showFullWord="controller.showFullWord.value"
              :showWordResult="controller.showWordResult.value"
              @update:showWordResult="controller.showWordResult.value = $event"
              :wordFontSize="size"
              @play="play"
              @complete="emit('complete')"
              @wrong="onWrong"
            />
          </div>
          <div class="word-meaning-slot">
            <Transition name="meaning"
              ><button
                v-if="meaning || controller.showWordResult.value"
                class="word-translation"
                aria-label="查看释义详情"
                @click="tapWord"
              >
                {{ word.trans.map(t => t.cn).join('；') }}
              </button></Transition
            >
          </div>
          <button
            v-if="examplePreview"
            class="sentence-preview"
            lang="en"
            aria-label="查看完整例句"
            @click="openDetails"
          >
            {{ examplePreview }}
          </button>
          <div class="word-tools">
            <button class="icon-button" aria-label="播放发音" @click="play()"><Icon name="sound" /></button
            ><button class="icon-button" aria-label="单词详情" @click="openDetails">
              <Icon name="detail" />
            </button>
          </div>
        </div>
        <div class="card-actions">
          <button class="icon-button" aria-label="再看" :disabled="flying" @click="decide(-1)">
            <Icon name="review" />
          </button>
          <button class="icon-button" aria-label="认识" :disabled="flying" @click="decide(1)">
            <Icon name="check" />
          </button>
        </div>
      </div>
    </Transition>
    <Footer />
    <Sheet
      :open="detailsOpen"
      :title="!detailRevealed && effective.isWordMasked && !controller.showWordResult.value ? '单词' : word.word"
      minimal
      floating
      draggable
      class="word-detail-sheet"
      @close="closeDetails"
    >
      <template v-if="detailRevealed || !effective.isWordMasked || controller.showWordResult.value">
        <div class="detail-word-heading">
          <h2 :style="{ fontSize: detailSize + 'px' }">{{ word.word }}</h2>
          <div class="detail-sound-row">
            <span v-if="phonetic" class="detail-phonetic">/{{ phonetic }}/</span
            ><button class="icon-button" aria-label="播放发音" @click="play()"><Icon name="sound" /></button>
          </div>
        </div>
        <p class="detail-meaning">{{ word.trans.map(t => t.pos + ' ' + t.cn).join('；') }}</p>
        <div class="word-examples">
          <div v-for="s in examples" :key="s.c">
            <p>{{ s.c }}</p>
            <p v-if="s.cn" class="sheet-note">{{ s.cn }}</p>
          </div>
        </div>
        <p v-if="store.noteData[word.word] && !editing" class="sheet-note">{{ store.noteData[word.word] }}</p>
        <div class="word-detail-actions">
          <button
            class="icon-button detail-bookmark"
            aria-label="收藏"
            :aria-pressed="isWordCollect(word)"
            :class="{ 'bookmark-bounce': bookmarkBounce }"
            @animationend="bookmarkBounce = false"
            @click="toggleCollection"
          >
            <Icon name="bookmark" />
          </button>
          <button class="icon-button" aria-label="笔记" :aria-expanded="editing" @click="editNote">
            <Icon name="pen" />
          </button>
        </div>
        <div v-if="editing" class="note-editor">
          <textarea v-model="note" aria-label="单词笔记" /><button
            class="icon-button"
            aria-label="保存"
            @click="saveNote"
          >
            <Icon name="check" />
          </button>
        </div>
      </template>
      <p v-else class="sheet-note">完成这一词后查看详情。</p>
    </Sheet>
  </div>
</template>

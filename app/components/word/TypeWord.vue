<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useWindowSize } from '@vueuse/core'
import type { Question, Word } from '@/core/types'
import { WordPlayTrigger, WordPracticeType, ShortcutKey } from '@/core/types/enum'
import { useBaseStore } from '@/core/stores/base'
import { useSettingStore } from '@/core/stores/setting'
import { usePlayWordAudio, cancelWordPracticeAudio } from '@/core/hooks/sound'
import { useInjectedDisplayPolicy } from '@/core/composables/practice-words/usePracticeDisplayPolicy'
import { usePracticeTypeWordController } from '@/core/composables/practice-words/usePracticeTypeWordController'
import { EventKey, useEvents } from '@/core/utils/eventBus'
import { useWordOptions } from '@/core/hooks/dict'
import { focusPracticeKeyboard, haptic } from '@/core/ielts/ui'
import WordTypingCore from './WordTypingCore.vue'
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
const detailsOpen = ref(false)
const meaning = ref(false)
const hint = ref(false)
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
const size = computed(() =>
  Math.min(58, (Math.min(width.value, 600) - 44) / (Math.max(1, props.word.word.length) * 0.54))
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
function tapWord() {
  if (suppressClick) {
    suppressClick = false
    return
  }
  play()
  meaning.value = !meaning.value
  if (meaning.value) controller.checkMaskedRevealWrong(!!typing.value?.isWordRight())
  focusPracticeKeyboard()
}
function onWrong() {
  haptic()
  emit('wrong', props.practiceType === WordPracticeType.Identify ? 'identifyTyping' : undefined)
}
function known() {
  emit('know')
  finishTimer = setTimeout(() => emit('complete'), 200)
}
function unknown() {
  onWrong()
  controller.showWordResult.value = true
  focusPracticeKeyboard()
}
let startX = 0,
  startY = 0,
  moved = false,
  suppressClick = false
let hold: ReturnType<typeof setTimeout> | undefined
let finishTimer: ReturnType<typeof setTimeout> | undefined
let hintTimer: ReturnType<typeof setTimeout> | undefined
function down(e: PointerEvent) {
  if (!e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return
  dragging.value = true
  dragX.value = 0
  startX = e.clientX
  startY = e.clientY
  moved = false
  suppressClick = false
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  hold = setTimeout(() => {
    suppressClick = true
    haptic()
  }, 420)
}
function move(e: PointerEvent) {
  if (!dragging.value) return
  const dx = e.clientX - startX,
    dy = e.clientY - startY
  if (Math.abs(dx) > Math.abs(dy) * 1.2) dragX.value = Math.max(-260, Math.min(36, dx < 0 ? dx : dx * 0.25))
  if (Math.hypot(e.clientX - startX, e.clientY - startY) > 9) {
    moved = true
    clearTimeout(hold)
  }
}
function up(e: PointerEvent) {
  clearTimeout(hold)
  dragging.value = false
  dragX.value = 0
  if (suppressClick && !moved) {
    play()
    return
  }
  if (moved) {
    suppressClick = true
    if (e.clientX - startX < -65 && Math.abs(e.clientY - startY) < 60) {
      haptic()
      emit('skip')
    }
  }
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
    dragX.value = 0
    dragging.value = false
    cancelWordPracticeAudio()
    controller.reset()
    editing.value = false
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
  document.addEventListener('visibilitychange', resumeAudio)
  if (!localStorage.getItem('ielts-gesture-hint-v1')) {
    hint.value = true
    localStorage.setItem('ielts-gesture-hint-v1', '1')
    hintTimer = setTimeout(() => {
      hint.value = false
    }, 4500)
  }
})
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', resumeAudio)
  clearTimeout(hold)
  clearTimeout(finishTimer)
  clearTimeout(hintTimer)
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
  <div v-if="word.word" class="typing-word" :data-practice-phase="phaseName">
    <Transition name="word-change" mode="out-in">
      <div :key="word.word + phaseKey" class="word-stage">
        <div
          class="word-swipe-surface"
          :class="{ dragging }"
          :style="{ '--word-drag': dragX + 'px', opacity: 1 - Math.min(0.5, Math.abs(dragX) / 400) }"
        >
          <div
            id="word-wrap"
            class="practice-word-target"
            role="button"
            tabindex="0"
            aria-label="单词，点按释义，长按发音，左滑跳过"
            :style="{ fontSize: size + 'px' }"
            @pointerdown="down"
            @pointermove="move"
            @pointerup="up"
            @pointercancel="cancel"
            @click="tapWord"
            @keydown.enter.prevent="tapWord"
            @keydown.space.prevent="play()"
            @contextmenu.prevent
          >
            <WordTypingCore
              ref="typing"
              :word="word"
              :active="!detailsOpen && !editing"
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
              ><p v-if="meaning || controller.showWordResult.value" class="word-translation">
                {{ word.trans.map(t => t.cn).join('；') }}
              </p></Transition
            >
          </div>
          <div
            v-if="practiceType === WordPracticeType.Identify && !controller.showWordResult.value"
            class="recall-actions"
          >
            <button class="icon-button" aria-label="还没记住" @click="unknown"><Icon name="review" /></button
            ><button class="icon-button" aria-label="记得" @click="known"><Icon name="check" /></button>
          </div>
          <div class="word-tools">
            <button class="icon-button" aria-label="播放发音" @click="play()"><Icon name="sound" /></button
            ><button class="icon-button" aria-label="单词详情" @click="detailsOpen = true"><Icon name="more" /></button>
          </div>
        </div>
      </div>
    </Transition>
    <Transition name="meaning"
      ><p v-if="hint" class="gesture-hint" role="status">点词查看 · 按住发音 · 左滑换词</p></Transition
    >
    <Sheet
      :open="detailsOpen"
      :title="effective.isWordMasked && !controller.showWordResult.value ? '单词' : word.word"
      minimal
      class="word-detail-sheet"
      @close="closeDetails"
    >
      <template v-if="!effective.isWordMasked || controller.showWordResult.value">
        <div class="detail-word-heading">
          <h2>{{ word.word }}</h2>
          <div class="detail-sound-row">
            <span v-if="word.phonetic0">/{{ word.phonetic0 }}/</span
            ><button class="icon-button" aria-label="播放发音" @click="play()"><Icon name="sound" /></button>
          </div>
        </div>
        <p class="detail-meaning">{{ word.trans.map(t => t.pos + ' ' + t.cn).join('；') }}</p>
        <div class="word-examples">
          <div v-for="s in word.sentences" :key="s.c">
            <p>{{ s.c }}</p>
            <p class="sheet-note">{{ s.cn }}</p>
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

<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
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
const size = computed(() => Math.min(46, 455 / Math.max(1, props.word.word.length)))
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
  startX = e.clientX
  startY = e.clientY
  moved = false
  suppressClick = false
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  hold = setTimeout(() => {
    suppressClick = true
    play()
  }, 420)
}
function move(e: PointerEvent) {
  if (Math.hypot(e.clientX - startX, e.clientY - startY) > 9) {
    moved = true
    clearTimeout(hold)
  }
}
function up(e: PointerEvent) {
  clearTimeout(hold)
  if (moved) {
    suppressClick = true
    if (e.clientX - startX < -65 && Math.abs(e.clientY - startY) < 60) {
      haptic()
      emit('skip')
    }
  }
}
function cancel() {
  clearTimeout(hold)
  suppressClick = true
}
watch(
  [() => props.word.word, () => props.phaseKey],
  () => {
    clearTimeout(hold)
    clearTimeout(finishTimer)
    cancelWordPracticeAudio()
    controller.reset()
    editing.value = false
    meaning.value = props.practiceType === WordPracticeType.FollowWrite
  },
  { immediate: true }
)
onMounted(() => {
  if (!localStorage.getItem('ielts-gesture-hint-v1')) {
    hint.value = true
    localStorage.setItem('ielts-gesture-hint-v1', '1')
    hintTimer = setTimeout(() => {
      hint.value = false
    }, 4500)
  }
})
onBeforeUnmount(() => {
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
  <div v-if="word.word" class="typing-word">
    <Transition name="word-change" mode="out-in">
      <div :key="word.word + phaseKey" class="word-stage">
        <p class="practice-phase">{{ phaseName }}</p>
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
        <Transition name="meaning"
          ><p v-if="meaning || controller.showWordResult.value" class="word-translation">
            {{ word.trans.map(t => t.cn).join('；') }}
          </p></Transition
        >
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
    </Transition>
    <Transition name="meaning"><p v-if="hint" class="gesture-hint">点按释义 · 长按发音 · 左滑跳过</p></Transition>
    <Sheet
      :open="detailsOpen"
      :title="effective.isWordMasked && !controller.showWordResult.value ? '单词' : word.word"
      @close="closeDetails"
    >
      <template v-if="!effective.isWordMasked || controller.showWordResult.value">
        <p class="detail-meaning">{{ word.trans.map(t => t.pos + ' ' + t.cn).join('；') }}</p>
        <div class="word-examples">
          <div v-for="s in word.sentences" :key="s.c">
            <p>{{ s.c }}</p>
            <p class="sheet-note">{{ s.cn }}</p>
          </div>
        </div>
        <p v-if="store.noteData[word.word] && !editing" class="sheet-note">{{ store.noteData[word.word] }}</p>
        <div class="word-detail-actions">
          <button class="text-action" @click="toggleWordCollect(word)">
            {{ isWordCollect(word) ? '已收藏' : '收藏' }}</button
          ><button class="text-action" @click="editNote">笔记</button>
        </div>
        <div v-if="editing" class="note-editor">
          <textarea v-model="note" aria-label="单词笔记" /><button class="text-action" @click="saveNote">保存</button>
        </div>
      </template>
      <p v-else class="sheet-note">完成这一词后查看详情。</p>
    </Sheet>
  </div>
</template>

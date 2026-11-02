<script setup lang="ts">
/**
 * 单词练习外壳组件
 * 此组件负责：
 * - 布局容器编排（组合 WordTypingCore / WordIdentifyPanel / WordMetaPanel）
 * - effective 显示策略计算
 * - 笔记 / 收藏 / 操作按钮
 * - 提示 Toast（按空格 / 按删除）
 * - defineExpose 透传
 *
 * 子组件：
 * - WordTypingCore：纯键入引擎
 * - WordIdentifyPanel：自测 / WordTest UI
 * - WordMetaPanel：音标 / 翻译 / 例句 / 短语 / 词源
 */
import type { Question, Word } from '@/core/types/types.ts'
import { getDefaultWord } from '@/core/types/func.ts'
import { ShortcutKey, WordPlayTrigger, WordPracticeType } from '@/core/types/enum.ts'
import { useBaseStore } from '@/core/stores/base.ts'
import { useSettingStore } from '@/core/stores/setting.ts'
import { usePlayWordAudio } from '@/core/hooks/sound.ts'
import { useInjectedDisplayPolicy } from '@/core/composables/practice-words/usePracticeDisplayPolicy.ts'
import { EventKey, useEvents } from '@/core/utils/eventBus.ts'
import { computed, ref, watch } from 'vue'
import WordLookupPopover from '@/components/word/WordLookupPopover.vue'
import { BaseButton, BaseIcon, Textarea, Toast, ToastComponent, Tooltip, VolumeIcon } from '@/base'
import { useI18n } from 'vue-i18n'
import { useWordOptions } from '@/core/hooks/dict.ts'
import { openWordCollectPicker } from '@/core/hooks/useWordCollectPicker.ts'
import WordTypingCore from './WordTypingCore.vue'
import WordIdentifyPanel from './WordIdentifyPanel.vue'
import WordMetaPanel from './WordMetaPanel.vue'
import Sheet from '@/components/ielts/Sheet.vue'
import { useOnKeyboardEventListener } from '@/core/hooks/event.ts'
import { _nextTick, throttle } from '@/core'
import { usePracticeTypeWordController } from '@/core/composables/practice-words/usePracticeTypeWordController.ts'

const { t: $t } = useI18n()

interface IProps {
  word: Word
  question?: Question | null
  /** 当前 Cursor 解析出的真实练习类型。 */
  practiceType: WordPracticeType
  /** 当前练习阶段标识，用于重置“显示单词”计错状态。 */
  phaseKey: string
}

const detailsOpen = ref(false)

const props = withDefaults(defineProps<IProps>(), {
  word: () => getDefaultWord(),
})

const emit = defineEmits<{
  complete: []
  wrong: [source?: 'identifyTyping']
  know: []
  mastered: []
  skip: []
  toggleSimple: []
  quickMark: []
}>()

const settingStore = useSettingStore()
const store = useBaseStore()

// ============ 音频 ============
const playWordAudio = usePlayWordAudio()

const volumeIconRef: any = $ref()
let isTypingWord = $ref(true)

const typingCoreRef = $ref<InstanceType<typeof WordTypingCore>>()
const wordMetaPanelRef = $ref<InstanceType<typeof WordMetaPanel>>()

const typeWordController = usePracticeTypeWordController({
  getWord: () => props.word,
  getPracticeType: () => props.practiceType,
  getPhaseKey: () => props.phaseKey,
  getIsWordMasked: () => effective.value.isWordMasked,
  getAutoPlayFirstSentence: () => false,
  onWrong: source => emit('wrong', source),
  playWordAudio: (word, manual, onEnd) =>
    playWordAudio(word, manual, onEnd, () => {
      volumeIconRef?.animate(true)
    }),
  playFirstSentence: () => wordMetaPanelRef?.playSentence(0, { highlight: true }),
})
let { showFullWord, showWordResult } = $(typeWordController)

const localReveal = computed(() => ({
  showFullWord,
  showWordResult,
}))
const effective = useInjectedDisplayPolicy(localReveal)

function playWord(trigger: WordPlayTrigger) {
  if (trigger === WordPlayTrigger.Manual || settingStore.wordSound) typeWordController.playWord(trigger)
}

function onTypingCoreComplete() {
  emit('complete')
}

function onTypingCoreWrong() {
  if (props.practiceType === WordPracticeType.Identify) {
    emit('wrong', 'identifyTyping')
    return
  }
  emit('wrong')
}

function onSentencePracticeComplete() {
  isTypingWord = true
  emit('complete')
}

// ============ 单词操作 ============
function checkIsWrong() {
  if (effective.value.isWordMasked) {
    if (!showWordResult && !typingCoreRef?.isWordRight()) {
      emit('wrong')
    }
  }
}

function onVolumeIconClick() {
  checkIsWrong()
  playWord(WordPlayTrigger.Manual)
}

function play() {
  volumeIconRef?.play()
}

function showWord() {
  typeWordController.showWord()
}

function hideWord() {
  typeWordController.hideWord()
}

const wordWrapRef = useTemplateRef('word-wrap')
function onMouseEnter() {
  if (props.practiceType === WordPracticeType.Identify) return
  //解决：默写情况下，单词显示为下划线，而下划线的宽度比字母的宽度更宽，导致hover上去，单词立马显示，导致整个div的宽度变窄，这样又会立马触发mouseleave
  let rect = wordWrapRef.value.getBoundingClientRect()
  wordWrapRef.value.style.minWidth = rect.width + 'px'
  _nextTick(showWord)
}

// ============ 笔记 ============

let editingNote = $ref(false)
let noteInputValue = $ref('')

function editNote() {
  editingNote = !editingNote
  if (editingNote) {
    noteInputValue = store.noteData[props.word.word] ?? ''
  } else {
    noteInputValue = ''
  }
}

function saveNote() {
  if (noteInputValue.trim()) {
    store.noteData[props.word.word] = noteInputValue
  } else {
    delete store.noteData[props.word.word]
  }
  editingNote = false
}

function cancelNote() {
  editingNote = false
  noteInputValue = ''
}

function deleteNote() {
  delete store.noteData[props.word.word]
  editingNote = false
  noteInputValue = ''
}

// ============ 自测/WordTest 事件处理 ============
let showNotice = false

function onIdentifyKnow() {
  if (!showWordResult) {
    showWordResult = true
    onAnswerCorrect()
    if (!showNotice) {
      Toast.info($t('know_word_tip'), { duration: 5000 })
      showNotice = true
    }
  }
}

function onAnswerWrong() {
  typingCoreRef?.setWordTestResult?.(false, props.word.word)
  emit('wrong')
  playWord(WordPlayTrigger.Typo)
}

function onAnswerCorrect() {
  typingCoreRef?.setWordTestResult?.(true, props.word.word)
  emit('know')
}

function onIdentifyUnknown() {
  if (!showWordResult) {
    showWordResult = true
    emit('wrong')
    playWord(WordPlayTrigger.Typo)
  }
}

function onIdentifyMastered() {
  emit('mastered')
}

// ============ 提示 Toast ============

const notice = $computed(() => {
  let text = ''
  let show = false
  if (props.practiceType === WordPracticeType.Identify) {
    if (showWordResult) {
      text = typingCoreRef?.isWordRight() ? '按空格键继续' : '请拼写单词'
      show = true
    }
  } else if (props.practiceType === WordPracticeType.Listen) {
    if (showWordResult) {
      text = '按空格键继续'
      show = true
    }
  } else if (props.practiceType === WordPracticeType.Dictation) {
    text = showWordResult
      ? typingCoreRef?.isWordRight()
        ? '按空格键继续'
        : $t('press_delete_reinput')
      : '按空格键完成默写'
    show = true
  } else {
    text = '输入完成后按空格键继续'
    show = true
  }
  return { show, text }
})

// ============ 重置：单词切换时 reset identify / note 状态 ============

watch([() => props.word, () => props.phaseKey], onResetWord)

// keyup 时隐藏单词
useOnKeyboardEventListener(
  () => {},
  () => {
    hideWord()
  }
)

function onResetWord() {
  isTypingWord = true
  typeWordController.reset()
  editingNote = false
  noteInputValue = ''
  if (wordWrapRef.value) wordWrapRef.value.style.minWidth = 'unset'
}

// ============ 收藏 / 简词 ============

const { isWordCollect, toggleWordCollect, isWordSimple, toggleWordSimple } = useWordOptions()
const collectAnchorRef = ref<HTMLElement | null>(null)

function openCollectPicker(e: MouseEvent) {
  e?.stopPropagation?.()
  openWordCollectPicker(props.word, e.currentTarget as HTMLElement, {
    excludeDictId: store.sdict.id ? String(store.sdict.id) : undefined,
  })
}

const isCollect = $computed(() => isWordCollect(props.word))
const isSimple = $computed(() => isWordSimple(props.word))
const showNote = $computed(() => {
  if (editingNote) return true
  if (store.noteData[props.word.word]?.trim()) {
    return settingStore.alwaysShowNote ? true : props.practiceType === WordPracticeType.FollowWrite || showWordResult
  }
  return false
})

function collect() {
  toggleWordCollect(props.word)
}

useEvents([
  [EventKey.resetWord, onResetWord],
  //当默写时，执行 show 会标记为错误，并更新卡片
  [ShortcutKey.ShowWord, throttle(showWord, 300)],
  [ShortcutKey.ToggleCollect, collect],
  [ShortcutKey.CollectToDict, () => openCollectPicker({ currentTarget: collectAnchorRef.value } as any)],
  [ShortcutKey.PlayWordPronunciation, play],
])
</script>

<template>
  <div class="typing-word" v-if="word.word.length">
    <div class="pronunciation-row">
      <span v-if="!effective.isWordMasked" class="phonetic">{{ settingStore.soundType === 'uk' ? word.phonetic0 : word.phonetic1 }}</span>
      <VolumeIcon ref="volumeIconRef" :cb="onVolumeIconClick" title="播放发音" />
    </div>
    <div id="word-wrap" ref="word-wrap" class="word" :style="{ fontSize: Math.min(38, 440 / word.word.length) + 'px' }">
      <WordTypingCore ref="typingCoreRef" :word="word" :active="isTypingWord && !editingNote && !detailsOpen"
        :practiceType="practiceType" :isWordMasked="effective.isWordMasked" v-model:showWordResult="showWordResult"
        :showFullWord="showFullWord" :wordFontSize="Math.min(38, 440 / word.word.length)"
        @play="playWord" @complete="onTypingCoreComplete" @wrong="onTypingCoreWrong" />
    </div>
    <p class="word-translation" v-if="effective.isShowTranslate">{{ word.trans.map(t => t.cn).join('；') }}</p>
    <p class="typing-hint" v-if="notice.show">{{ notice.text.replace('按空格键继续', '点继续或按空格键') }}</p>
    <WordIdentifyPanel v-if="!showWordResult && !showFullWord && practiceType === WordPracticeType.Identify"
      :key="word.word" :word="word" :question="question" @know="onIdentifyKnow" @unknown="onIdentifyUnknown"
      @mastered="onIdentifyMastered" @wrong="onAnswerWrong" @correct="onAnswerCorrect" @complete="emit('complete')" @quickMark="emit('quickMark')" />
    <button class="word-details-button" aria-label="单词详情" @click="detailsOpen = true">···</button>
    <Sheet :open="detailsOpen" :title="effective.isWordMasked && !showWordResult ? '单词操作' : word.word" @close="detailsOpen = false; cancelNote()">
      <template v-if="!effective.isWordMasked || showWordResult">
        <p class="sheet-note">{{ word.trans.map(t => t.pos + ' ' + t.cn).join('；') }}</p>
        <div class="word-examples"><div v-for="sentence in word.sentences" :key="sentence.c"><p>{{ sentence.c }}</p><p class="sheet-note">{{ sentence.cn }}</p></div></div>
        <p class="sheet-note" v-if="store.noteData[word.word]">{{ store.noteData[word.word] }}</p>
        <div class="word-detail-actions"><button @click="collect">{{ isCollect ? '取消收藏' : '收藏' }}</button><button @click="toggleWordSimple(word)">{{ isSimple ? '取消掌握' : '标为掌握' }}</button><button @click="editNote">笔记</button></div>
        <div v-if="editingNote"><textarea v-model="noteInputValue" aria-label="单词笔记" /><button @click="saveNote">保存笔记</button></div>
      </template>
      <p v-else class="sheet-note">完成听写后再查看释义和例句。</p>
    </Sheet>
  </div>
</template>
<style scoped>
.typing-word { width: 100%; max-width: 540px; margin: auto; text-align: center; padding: 60px 8px 40px; box-sizing: border-box; color: var(--ielts-text); }
.pronunciation-row { min-height: 32px; display: flex; align-items: center; justify-content: center; gap: 12px; color: var(--ielts-muted); margin-bottom: 28px; }
.phonetic { font-size: 15px; }
.word { display: flex; justify-content: center; line-height: 1.5; letter-spacing: .025em; font-family: var(--font-family); }
.word-translation { font-size: 16px; color: #bec3c0; line-height: 1.8; margin: 24px 0 0; }
.typing-hint { font-size: 12px; color: var(--ielts-muted); margin-top: 28px; line-height: 1.8; }
.word-details-button { color: var(--ielts-muted); border: 0; background: none; padding: 14px; min-height: 44px; margin-top: 24px; font-size: 24px; letter-spacing: 3px; }
.word-examples { display: grid; gap: 20px; text-align: left; margin: 28px 0; }
.word-examples p { font-size: 15px; line-height: 1.6; margin: 0 0 8px; }
.word-examples p.sheet-note { font-size: 12px; }
.word-detail-actions { display: flex; gap: 20px; justify-content: space-between; margin-top: 24px; }
.word-detail-actions button { color: var(--ielts-accent); background: none; border: 0; padding: 12px 0; font-size: 13px; }
textarea { box-sizing: border-box; width: 100%; margin-top: 16px; background: #202328; color: var(--ielts-text); border: 0; padding: 14px; border-radius: 12px; }
@media (min-width: 700px) { .typing-word { padding-top: 100px; } }
</style>

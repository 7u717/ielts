<script setup lang="ts">
import { haptic } from '@/core/ielts/ui'
import type { Word } from '@/core/types/types.ts'
import { getDefaultWord } from '@/core/types/func.ts'
import { WordPlayTrigger, WordPracticeType } from '@/core/types/enum.ts'
import { useSettingStore } from '@/core/stores/setting.ts'
import { resetActiveWordPlayCount, usePlayBeep, usePlayCorrect, usePlayKeyboardAudio } from '@/core/hooks/sound.ts'
import { emitter, EventKey } from '@/core/utils/eventBus.ts'
import { onUnmounted, watch, ref } from 'vue'
import Space from '@/components/article/Space.vue'
import { _nextTick, last } from '@/core/utils'
import { useOnKeyboardEventListener } from '@/core/hooks/event.ts'
import { Toast } from '@/base'
import { usePracticeWordTyping } from '@/core/composables/practice-words/usePracticeWordTyping.ts'

interface IProps {
  word: Word
  practiceType: WordPracticeType
  isWordMasked: boolean
  showWordResult: boolean
  showFullWord: boolean
  wordFontSize: number
  active?: boolean
  minimalInput?: boolean
}

const props = withDefaults(defineProps<IProps>(), {
  word: () => getDefaultWord(),
  showWordResult: false,
  active: true,
  minimalInput: false,
  showFullWord: false,
  isWordMasked: false,
  wordFontSize: 48,
})

const emit = defineEmits<{
  'update:showWordResult': [value: boolean]
  complete: []
  wrong: []
  play: [trigger: WordPlayTrigger]
}>()

const errorPulse = ref(0)
const settingStore = useSettingStore()
const playBeep = usePlayBeep()
const playCorrect = usePlayCorrect()
const playKeyboardAudio = usePlayKeyboardAudio()

const typing = usePracticeWordTyping({
  getWord: () => props.word,
  getPracticeType: () => props.practiceType,
  getIsWordMasked: () => props.isWordMasked,
  getShowWordResult: () => props.showWordResult,
  getSettings: () => ({ ...settingStore, autoNextWord: true, repeatCount: 1, waitTimeForChangeWord: 200 }),
  setShowWordResult: value => emit('update:showWordResult', value),
  onComplete: () => emit('complete'),
  onWrong: () => {
    errorPulse.value++
    emit('wrong')
  },
  onPlay: trigger => emit('play', trigger),
  playBeep,
  playCorrect,
  playKeyboardAudio,
  resetWordPlayCount: resetActiveWordPlayCount,
})

const {
  input,
  wrong,
  wholeInputAttempt,
  inputLock,
  inputCharacterStates,
  isWordCorrect,
  typeCharacter,
  backspace,
  reset,
  setWordTestResult,
  clearDeferredTimers,
} = typing

watch(inputCharacterStates, states => {
  if (states.length && !states[states.length - 1].isCorrect) {
    haptic()
    errorPulse.value++
  }
})

const displayWord = $computed(() => props.word.word.slice(input.value.length + wrong.value.length))
let cursor = $ref({ top: 0, left: 0 })
const typingWordRef = $ref<HTMLDivElement>()

function onTyping(event: KeyboardEvent) {
  if (event.code === 'Backspace') {
    backspace()
    return
  }
  typeCharacter({ key: event.key, code: event.code, shiftKey: event.shiftKey })
}

function checkCursorPosition() {
  _nextTick(() => {
    if (!typingWordRef) return
    const typingWordRect = typingWordRef.getBoundingClientRect()
    const inputList = typingWordRef.querySelectorAll('.l')
    if (inputList.length) {
      const inputRect = last(Array.from(inputList)).getBoundingClientRect()
      cursor = {
        top: inputRect.top - typingWordRect.top,
        left: inputRect.right - typingWordRect.left,
      }
      return
    }
    const element = typingWordRef.querySelector('.dictation') ?? typingWordRef.querySelector('.letter')
    const rect = element?.getBoundingClientRect()
    if (!rect) return
    cursor = {
      top: rect.top - typingWordRect.top,
      left: rect.left - typingWordRect.left,
    }
  })
}

function resetTypingCore(trigger: WordPlayTrigger) {
  reset(trigger)
  checkCursorPosition()
}

function onResetWord() {
  resetTypingCore(WordPlayTrigger.ResetSameWord)
}

useOnKeyboardEventListener(
  () => {},
  () => {}
)

watch(
  () => props.word,
  () => resetTypingCore(WordPlayTrigger.NewWord),
  { immediate: true }
)

watch([input, () => props.showFullWord, () => props.practiceType], checkCursorPosition)

function deactivate() {
  clearDeferredTimers()
  emitter.off(EventKey.resetWord, onResetWord)
  emitter.off(EventKey.onTyping, onTyping)
}

watch(
  () => props.active,
  active => {
    deactivate()
    if (active) {
      emitter.on(EventKey.resetWord, onResetWord)
      emitter.on(EventKey.onTyping, onTyping)
      checkCursorPosition()
    }
  },
  { immediate: true }
)

onUnmounted(deactivate)

defineExpose({
  isWordRight: () => isWordCorrect.value,
  setWordTestResult,
})
</script>

<template>
  <div
    ref="typingWordRef"
    class="typing-core"
    :class="{
      'is-wrong': wrong || (wholeInputAttempt && inputLock && !isWordCorrect),
      'shake-odd': errorPulse % 2 === 1,
      'shake-even': errorPulse > 0 && errorPulse % 2 === 0,
      'is-complete': isWordCorrect && input.length > 0,
    }"
  >
    <template v-for="(item, index) in inputCharacterStates" :key="index"
      ><span class="l" :class="item.isCorrect ? 'input' : 'wrong'">{{
        item.character === ' ' ? '\u00a0' : item.character
      }}</span></template
    >
    <span v-if="wrong" class="wrong">{{ wrong }}</span>
    <span v-if="active && !isWordCorrect" class="typing-caret" aria-hidden="true" />
    <span class="letter" v-if="isWordMasked && !showFullWord">{{
      minimalInput ? '' : displayWord.replace(/[^ ]/g, '·')
    }}</span>
    <span v-else class="letter">{{ displayWord }}</span>
  </div>
</template>
<style scoped>
.typing-core {
  display: inline-block;
  position: relative;
  font-family: var(--r-num);
  font-weight: 400;
  letter-spacing: -0.025em;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.4;
}
.letter {
  color: #e5e5ea;
}
.input {
  color: #f5f5f7;
}
.wrong {
  color: #e9aaaa;
}
.typing-core.shake-odd {
  animation: typing-error 0.16s var(--r-ease);
}
.typing-core.shake-even {
  animation: typing-error-repeat 0.16s var(--r-ease);
}
.l {
  display: inline-block;
  position: relative;
  z-index: 1;
  animation: letter-arrive 0.18s var(--r-spring);
}
.letter,
.wrong {
  position: relative;
  z-index: 1;
}
.typing-caret {
  display: inline-block;
  width: 1px;
  margin-right: -1px;
  height: 0.85em;
  vertical-align: -0.07em;
  background: var(--text);
  opacity: 0.65;
  animation: caret-breathe 1.2s steps(1, end) infinite;
}
.is-complete::before {
  content: '';
  position: absolute;
  inset: -8px -14px;
  background: var(--completion-glow, rgba(255, 255, 255, 0.08));
  filter: blur(12px);
  border-radius: 20px;
  pointer-events: none;
  animation: completion-wash 0.2s var(--r-ease) both;
}
@keyframes letter-arrive {
  from {
    opacity: 0.35;
    transform: translateY(2px) scale(0.98);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@keyframes caret-breathe {
  0%,
  100% {
    opacity: 0.65;
  }
  50% {
    opacity: 0;
  }
}
@keyframes completion-wash {
  0%,
  100% {
    opacity: 0;
  }
  45% {
    opacity: 1;
  }
}
@keyframes typing-error-repeat {
  0%,
  100% {
    transform: translateX(0);
  }
  35% {
    transform: translateX(-2px);
  }
  70% {
    transform: translateX(2px);
  }
}
@keyframes typing-error {
  0%,
  100% {
    transform: translateX(0);
  }
  35% {
    transform: translateX(-2px);
  }
  70% {
    transform: translateX(2px);
  }
}
</style>

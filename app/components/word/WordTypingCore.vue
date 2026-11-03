<script setup lang="ts">
import { haptic } from '@/core/ielts/ui'
import type { Word } from '@/core/types/types.ts'
import { getDefaultWord } from '@/core/types/func.ts'
import { WordPlayTrigger, WordPracticeType } from '@/core/types/enum.ts'
import { useSettingStore } from '@/core/stores/setting.ts'
import { resetActiveWordPlayCount, usePlayBeep, usePlayCorrect, usePlayKeyboardAudio } from '@/core/hooks/sound.ts'
import { emitter, EventKey } from '@/core/utils/eventBus.ts'
import { onUnmounted, watch } from 'vue'
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
}

const props = withDefaults(defineProps<IProps>(), {
  word: () => getDefaultWord(),
  showWordResult: false,
  active: true,
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
  onWrong: () => emit('wrong'),
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
  if (states.length && !states[states.length - 1].isCorrect) haptic()
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
    :class="{ 'is-wrong': wrong || (wholeInputAttempt && inputLock && !isWordCorrect) }"
  >
    <template v-for="(item, index) in inputCharacterStates" :key="index"
      ><span class="l" :class="item.isCorrect ? 'input' : 'wrong'">{{
        item.character === ' ' ? '\u00a0' : item.character
      }}</span></template
    >
    <span v-if="wrong" class="wrong">{{ wrong }}</span>
    <span class="letter" v-if="isWordMasked && !showFullWord">{{ displayWord.replace(/[^ ]/g, '·') }}</span>
    <span v-else class="letter">{{ displayWord }}</span>
  </div>
</template>
<style scoped>
.typing-core {
  display: inline;
  font-family: var(--r-num);
  font-weight: 300;
  letter-spacing: -0.025em;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  line-height: 1.4;
}
.letter {
  color: var(--muted);
}
.input {
  color: #f5f5f7;
}
.wrong {
  color: #e9aaaa;
}
.is-wrong {
  animation: typing-error 0.16s var(--r-ease);
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

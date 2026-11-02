<script setup lang="ts">
import { computed, inject, type Ref } from 'vue'
import type { PracticeData } from '@/core/composables/practice-words/practice-word-session'
import type { PracticeFlowConfig, PracticeFlowCursor } from '@/core/composables/practice-words/practice-flow-types'
import { getPracticeFlowDisplayState } from '@/core/composables/practice-words/practice-flow-display'
import { useInjectedDisplayActions } from '@/core/composables/practice-words/usePracticeDisplayPolicy'
import { emitter, EventKey } from '@/core/utils/eventBus'
import { useI18n } from 'vue-i18n'
const emit = defineEmits<{ skipStep: [] }>()
const data = inject<PracticeData>('practiceData')!
const cursor = inject<Ref<PracticeFlowCursor>>('practiceFlowCursor')!
const config = inject<Ref<PracticeFlowConfig>>('practiceFlowConfig')!
const { t } = useI18n()
const display = useInjectedDisplayActions()
const flow = computed(() => getPracticeFlowDisplayState({ config: config.value, cursor: cursor.value, wordIndex: data.index, wordCount: data.words.length, translate: t }))
function keyboard() { (document.querySelector('#typing-listener') as HTMLInputElement)?.focus() }
function next() { emitter.emit(EventKey.onTyping, { key: ' ', code: 'Space', shiftKey: false } as KeyboardEvent) }
</script>
<template>
  <footer class="practice-dock">
    <div class="practice-status"><span>{{ flow.status }}</span><span>{{ Math.min(data.index + 1, data.words.length) }} / {{ data.words.length }}</span></div>
    <div class="session-track" role="progressbar" aria-label="本组进度" :aria-valuenow="data.index" :aria-valuemax="data.words.length" aria-valuemin="0"><div :style="{ width: (data.index / Math.max(1, data.words.length) * 100) + '%' }" /></div>
    <div class="practice-controls"><button @click="keyboard" aria-label="打开键盘">键盘</button><button @click="display.toggleTranslate()">释义</button><button v-if="flow.showSkipStep" @click="emit('skipStep')" aria-label="进入下一阶段">下一阶段</button><button @click="next">继续 →</button></div>
  </footer>
</template>
<style scoped>
.practice-dock { padding: 18px 28px max(18px, env(safe-area-inset-bottom)); background: var(--ielts-bg); color: var(--ielts-muted); box-sizing: border-box; width: 100%; }
.practice-status { display: flex; justify-content: space-between; font-size: 12px; gap: 16px; }
.session-track { height: 1px; background: #282c2e; margin-top: 16px; }
.session-track div { height: 1px; background: var(--ielts-accent); transition: width 240ms ease; }
.practice-controls { display: flex; justify-content: space-between; gap: 12px; margin-top: 8px; }
.practice-controls button { padding: 12px 0; min-height: 44px; color: var(--ielts-muted); background: none; border: 0; font-size: 12px; }
.practice-controls button:last-child { color: var(--ielts-accent); }
</style>

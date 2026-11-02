<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import topics from '@/core/ielts/topics.json'
import { useBaseStore } from '@/core/stores/base'
import { useSettingStore } from '@/core/stores/setting'
import { selectTopic } from '@/core/ielts/session'
import { createStudyTask } from '@/core/composables/practice-words/study-task'
import { usePracticeWordPersistence } from '@/core/composables/practice-words/practice-word-session'
import { useDataSyncPersistence } from '@/core/composables/useDataSyncPersistence'
import { useNav } from '@/core/utils'
import { WordPracticeMode } from '@/core/types/enum'
import { Toast } from '@/base'
import Sheet from './Sheet.vue'
const store = useBaseStore()
const settings = useSettingStore()
const persistence = usePracticeWordPersistence()
const { nav } = useNav()
const panel = ref<'topics' | 'words' | null>(null)
const tab = ref<'learn' | 'wrong' | 'review'>('learn')
const mode = ref(WordPracticeMode.System)
const busy = ref(true)
const error = ref('')
const hasSession = ref(false)
const topic = computed(() => topics.find(t => t.id === store.sdict.id) || topics[0])
const progress = computed(() => store.sdict.complete ? 1 : Math.min(1, store.sdict.lastLearnIndex / Math.max(1, store.sdict.length)))
const review = computed(() => store.load && !busy.value ? createStudyTask().taskWords.review : [])
const title = computed(() => tab.value === 'wrong' ? '让错词，变熟悉。' : tab.value === 'review' ? '在忘记之前，再见。' : '每天一点，离雅思更近。')
watch(() => store.load, async loaded => {
  if (!loaded) return
  try {
    await selectTopic(topic.value as any)
    hasSession.value = !!await persistence.load()
  } catch (e) { error.value = '词库加载失败，点此重试'; console.error(e) }
  finally { busy.value = false }
}, { immediate: true })
async function choose(t: typeof topics[number]) {
  busy.value = true
  try { await selectTopic(t as any); hasSession.value = !!await persistence.load(); panel.value = null; error.value = '' }
  catch (e) { error.value = '词库加载失败，点此重试'; console.error(e) }
  finally { busy.value = false }
}
async function start() {
  if (busy.value) return
  busy.value = true
  try {
    const cached = await persistence.load()
    if (cached) { nav('/practice-words/' + store.sdict.id, {}, cached); return }
    const task = createStudyTask().taskWords
    if (tab.value === 'wrong') { task.new = []; task.review = store.wrong.words.filter(w => store.sdict.words.some(v => v.word === w.word)) }
    if (tab.value === 'review') task.new = []
    if (!task.new.length && !task.review.length) { Toast.info(tab.value === 'wrong' ? '当前话题还没有错词' : '今天的复习已完成，去学几个新词吧'); return }
    settings.wordPracticeMode = tab.value === 'learn' ? mode.value : WordPracticeMode.Review
    settings.first = false
    await useDataSyncPersistence().saveDictState()
    nav('/practice-words/' + store.sdict.id, {}, { taskWords: task })
  } catch (e) { Toast.error('无法读取练习，请导出备份后重试'); console.error(e) }
  finally { busy.value = false }
}
const wrongWords = computed(() => store.wrong.words)
</script>
<template>
  <main class="ielts-home">
    <div class="home-heading"><p>{{ title }}</p></div>
    <button class="topic-orbit" aria-label="选择雅思话题" @click="panel = 'topics'">
      <svg viewBox="0 0 200 200" aria-hidden="true" class="orbit"><circle class="orbit-track" cx="100" cy="100" r="79" /><circle class="orbit-progress" cx="100" cy="100" r="79" :stroke-dasharray="`${progress * 496.37} 496.37`" /><circle class="orbit-dot" cx="100" cy="21" r="3" /></svg>
      <svg class="topic-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width=".85" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="topic.icon" /></svg>
    </button>
    <button class="topic-name" @click="panel = 'topics'">{{ topic.name }} <span aria-hidden="true">⌄</span></button>
    <button class="quiet progress-caption" @click="panel = 'words'">{{ store.sdict.complete ? '已完成这一话题' : '已学 ' + store.sdict.lastLearnIndex + ' / ' + topic.length }}<span aria-hidden="true"> ↗</span></button>
    <div class="study-actions">
      <div v-if="tab === 'learn' && !hasSession" class="mode-picker" aria-label="学习模式">
        <button v-for="m in [{id: WordPracticeMode.System, name: '学习'}, {id: WordPracticeMode.Free, name: '打字'}, {id: WordPracticeMode.ListenOnly, name: '听写'}]" :aria-pressed="mode === m.id" @click="mode = m.id">{{ m.name }}</button>
      </div>
      <p v-else class="quiet session-note">{{ hasSession ? '上次的练习，接着来' : tab === 'wrong' ? '从当前话题的错词开始' : review.length ? '今天的到期单词已准备好' : '今天没有到期单词' }}</p>
      <button class="primary-action" :disabled="busy || !!error" @click="start">{{ busy ? '准备中' : hasSession ? '继续练习' : tab === 'wrong' ? '巩固错词' : tab === 'review' ? '开始复习' : '开始学习' }} <span aria-hidden="true">→</span></button>
      <button v-if="error" class="error-action" @click="choose(topic)">{{ error }}</button>
      <button v-else-if="tab === 'wrong'" class="quiet secondary-action" @click="panel = 'words'">查看错词本</button>
    </div>
    <nav class="home-tabs" aria-label="学习导航">
      <button v-for="t in [{id: 'learn', name: '学习', path: 'M4 6h6a2 2 0 0 1 2 2v12a4 4 0 0 0-4-2H4V6Zm16 0h-6a2 2 0 0 0-2 2m8-2v12h-4a4 4 0 0 0-4 2'}, {id: 'wrong', name: '错词', path: 'M8 3h8v18l-4-3-4 3V3Z'}, {id: 'review', name: '复习', path: 'M4 8a8 8 0 1 1 0 8M4 3v5h5m3 0v5l3 2'}]" :aria-current="tab === t.id ? 'page' : undefined" @click="tab = t.id as any">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path :d="t.path" /></svg><span>{{ t.name }}</span>
      </button>
    </nav>
    <Sheet :open="panel === 'topics'" title="选择话题" @close="panel = null">
      <div class="topic-list"><button v-for="t in topics" :disabled="busy" :aria-pressed="topic.id === t.id" @click="choose(t)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path :d="t.icon" /></svg><span>{{ t.name }}</span><span class="quiet">{{ topic.id === t.id ? '✓' : '↗' }}</span></button></div>
    </Sheet>
    <Sheet :open="panel === 'words'" :title="tab === 'wrong' ? '错词本' : topic.name" @close="panel = null">
      <p v-if="tab === 'wrong' && !wrongWords.length" class="sheet-note">还没有错词，继续保持。</p>
      <div class="vocabulary-list"><div v-for="w in tab === 'wrong' ? wrongWords : store.sdict.words" :key="w.word"><span>{{ w.word }}</span><span class="quiet">{{ w.trans[0]?.cn }}</span></div></div>
    </Sheet>
  </main>
</template>

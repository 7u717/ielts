<script setup lang="ts">
import { computed, ref, watch, onBeforeUnmount } from 'vue'
import topics from '@/core/ielts/topics.json'
import { useBaseStore } from '@/core/stores/base'
import { useSettingStore } from '@/core/stores/setting'
import { selectTopic, selectSavedDictionary, selectReviewSession, selectModeSession } from '@/core/ielts/session'
import { createStudyTask } from '@/core/composables/practice-words/study-task'
import { usePracticeWordPersistence } from '@/core/composables/practice-words/practice-word-session'
import { useDataSyncPersistence } from '@/core/composables/useDataSyncPersistence'
import { useWordOptions } from '@/core/hooks/dict'
import { usePlayWordAudio } from '@/core/hooks/sound'
import { useNav } from '@/core/utils'
import { WordPracticeMode, SyncDataType } from '@/core/types/enum'
import type { Word } from '@/core/types'
import { haptic, useIeltsUI } from '@/core/ielts/ui'
import { Toast } from '@/base'
import Sheet from './Sheet.vue'
import Icon from './Icon.vue'
import Ring from './Ring.vue'
import Tabs from './Tabs.vue'
import WordRow from './WordRow.vue'
import TopicMenu from './TopicMenu.vue'
import Vocabulary from './Vocabulary.vue'
import ModeSwitch from './ModeSwitch.vue'
const store = useBaseStore()
const settings = useSettingStore()
const persistence = usePracticeWordPersistence()
const dataSync = useDataSyncPersistence()
const { delWrongWord } = useWordOptions()
const speak = usePlayWordAudio()
const { nav } = useNav()
const { tab, topicsOpen } = useIeltsUI()
const mode = ref(WordPracticeMode.System)
const busy = ref(true)
const error = ref('')
const hasSession = ref(false)
const wordDetails = ref<Word | null>(null)
const vocabularyOpen = ref(false)
const overviewOpen = ref(false)
const progressPeek = ref('')
let progressTimer: ReturnType<typeof setTimeout> | undefined
function peekProgress(t: (typeof topics)[number]) {
  clearTimeout(progressTimer)
  progressPeek.value = t.id
  progressTimer = setTimeout(() => {
    progressPeek.value = ''
  }, 1600)
  void choose(t)
}
onBeforeUnmount(() => clearTimeout(progressTimer))
const topic = computed(() => topics.find(t => t.id === store.sdict.id) || topics[0])
const topicProgress = (id: string) => {
  const dict = store.word.bookList.find(d => d.id === id)
  return dict?.complete ? 1 : Math.min(1, (dict?.lastLearnIndex || 0) / (dict?.length || 24))
}
const today = computed(() =>
  store.word.bookList
    .flatMap(d => d.statistics)
    .filter(s => new Date(s.startDate).toDateString() === new Date().toDateString())
    .reduce((n, s) => n + (s.new || 0), 0)
)
const dailyGoal = computed(() => store.sdict.perDayStudyNumber || 20)
const review = computed(() => (store.load && !busy.value ? createStudyTask().taskWords.review : []))
const list = computed(() => (tab.value === 'wrong' ? store.wrong.words : review.value))
watch(
  () => store.load,
  async loaded => {
    if (!loaded) return
    try {
      if (
        [WordPracticeMode.System, WordPracticeMode.Free, WordPracticeMode.ListenOnly].includes(
          settings.wordPracticeMode
        )
      )
        mode.value = settings.wordPracticeMode
      await selectTopic(topic.value as any)
      await selectModeSession(mode.value)
      hasSession.value = !!(await persistence.load())
    } catch (e) {
      error.value = '词库未载入，点此重试'
      console.error(e)
    } finally {
      busy.value = false
    }
  },
  { immediate: true }
)
async function choose(t: (typeof topics)[number]) {
  if (busy.value) return
  busy.value = true
  try {
    await selectTopic(t as any)
    await selectModeSession(mode.value)
    hasSession.value = !!(await persistence.load())
    topicsOpen.value = false
    error.value = ''
  } catch (e) {
    error.value = '词库未载入，点此重试'
    console.error(e)
  } finally {
    busy.value = false
  }
}
function chooseFromMenu(id: string) {
  const found = topics.find(t => t.id === id)
  if (found) void choose(found)
}
async function chooseMode(next: WordPracticeMode) {
  if (busy.value || next === mode.value) return
  busy.value = true
  try {
    await selectModeSession(next)
    mode.value = next
    hasSession.value = !!(await persistence.load())
  } catch (e) {
    Toast.error('暂时无法切换，请重试')
    console.error(e)
  } finally {
    busy.value = false
  }
}
async function start() {
  if (busy.value || error.value) return
  overviewOpen.value = false
  busy.value = true
  try {
    if (tab.value === 'wrong') {
      if (!store.wrong.words.length) return
      await selectSavedDictionary(store.wrong)
    }
    if (tab.value === 'review') await selectReviewSession()
    if (tab.value === 'learn') await selectModeSession(mode.value)
    const cached = await persistence.load()
    if (cached) {
      await dataSync.saveLocalAndSync(SyncDataType.setting, settings.$state)
      nav('/practice-words/' + store.sdict.id, {}, cached)
      return
    }
    const task = createStudyTask().taskWords
    if (tab.value === 'wrong') {
      task.new = []
      task.review = [...store.wrong.words]
    }
    if (tab.value === 'review') task.new = []
    if (!task.new.length && !task.review.length) {
      Toast.info('今天的复习已完成')
      return
    }
    settings.wordPracticeMode = tab.value === 'learn' ? mode.value : WordPracticeMode.Review
    settings.first = false
    await dataSync.saveDictState()
    await dataSync.saveLocalAndSync(SyncDataType.setting, settings.$state)
    await persistence.save({ taskWords: task })
    nav('/practice-words/' + store.sdict.id, {}, { taskWords: task })
  } catch (e) {
    Toast.error('练习暂时无法打开，请先导出备份')
    console.error(e)
  } finally {
    busy.value = false
  }
}
function removeDetailedWord() {
  if (wordDetails.value) void removeWord(wordDetails.value)
  wordDetails.value = null
}
async function removeWord(word: Word) {
  delWrongWord(word)
  await dataSync.saveDictState()
}
let swipeStart: { x: number; y: number } | null = null
function down(e: PointerEvent) {
  if ((e.target as HTMLElement).closest('[data-horizontal], nav, dialog')) return
  swipeStart = { x: e.clientX, y: e.clientY }
}
function up(e: PointerEvent) {
  if (!swipeStart) return
  const dx = e.clientX - swipeStart.x,
    dy = e.clientY - swipeStart.y
  swipeStart = null
  if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy) * 1.4) {
    const tabs = ['learn', 'wrong', 'review'] as const
    const index = Math.max(0, Math.min(2, tabs.indexOf(tab.value) + (dx < 0 ? 1 : -1)))
    if (tabs[index] !== tab.value) {
      haptic()
      tab.value = tabs[index]
    }
  }
}
let grabY = 0
function grabDown(e: PointerEvent) {
  grabY = e.clientY
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function grabUp(e: PointerEvent) {
  if (e.clientY < grabY - 20) vocabularyOpen.value = true
}
</script>
<template>
  <main class="ielts-home" @pointerdown="down" @pointerup="up" @pointercancel="swipeStart = null">
    <Transition name="tab-page" mode="out-in">
      <section
        v-if="tab === 'learn'"
        id="panel-learn"
        key="learn"
        role="tabpanel"
        aria-labelledby="tab-learn"
        class="overview-panel"
      >
        <div class="overview-hero">
          <button
            class="hero-ring-button"
            :disabled="busy || !!error"
            :aria-label="hasSession ? '继续学习' : '开始学习'"
            aria-haspopup="dialog"
            @click="overviewOpen = true"
          >
            <Transition name="hero-theme" mode="out-in"
              ><Ring :key="topic.id" :progress="today / dailyGoal" :size="250"
                ><span class="hero-topic">{{ topic.name }}</span></Ring
              ></Transition
            >
          </button>
          <div class="mode-controls">
            <span aria-hidden="true" />
            <ModeSwitch :model-value="mode" :disabled="busy" @update:model-value="chooseMode" />
            <button
              class="icon-button vocabulary-entry-button"
              :aria-label="topic.name + '词表，上拉展开'"
              @click="vocabularyOpen = true"
              @pointerdown.stop="grabDown"
              @pointerup.stop="grabUp"
            >
              <Icon name="list" />
            </button>
          </div>
        </div>
        <div class="topic-progress">
          <div class="topic-strip" data-horizontal>
            <button
              v-for="t in topics"
              :key="t.id"
              class="topic-progress-item"
              :aria-label="`${t.name}，已学 ${Math.round(topicProgress(t.id) * 100)}%`"
              :aria-pressed="topic.id === t.id"
              :disabled="busy"
              @click="peekProgress(t)"
            >
              <Ring :progress="topicProgress(t.id)" :size="42" small
                ><Transition name="meaning"
                  ><span v-if="progressPeek === t.id" class="ring-peek"
                    >{{ Math.round(topicProgress(t.id) * 100) }}<small>%</small></span
                  ></Transition
                ></Ring
              ><span>{{ t.name }}</span>
            </button>
          </div>
        </div>
        <button v-if="error" class="error-action" @click="choose(topic)">{{ error }}</button>
        <span v-if="busy" class="loading-note" role="status">正在载入</span>
      </section>
      <section
        v-else
        :id="'panel-' + tab"
        :key="tab"
        role="tabpanel"
        :aria-labelledby="'tab-' + tab"
        class="word-list-panel"
      >
        <div class="list-heading">
          <button class="list-context" @click="topicsOpen = true">
            {{ tab === 'wrong' ? '全部错词' : topic.name }}<Icon v-if="tab === 'review'" name="down" /></button
          ><button
            class="icon-button"
            :aria-label="tab === 'wrong' ? '巩固错词' : '开始复习'"
            :disabled="busy || !list.length"
            @click="start"
          >
            <Icon name="play" />
          </button>
        </div>
        <div v-if="list.length" class="word-list">
          <WordRow
            v-for="word in list"
            :key="word.word"
            :word="word"
            :removable="tab === 'wrong'"
            @open="wordDetails = $event"
            @remove="removeWord"
          />
        </div>
        <div v-else class="list-empty">
          <Icon :name="tab === 'wrong' ? 'check' : 'review'" />
          <p>{{ tab === 'wrong' ? '还没有错词' : '今天没有到期词' }}</p>
        </div>
      </section>
    </Transition>
    <Tabs v-model="tab" />
    <ClientOnly
      ><Teleport to="#topic-menu-mount"
        ><TopicMenu
          :open="topicsOpen"
          :selected="topic.id"
          :topics="topics"
          :busy="busy"
          @toggle="topicsOpen = !topicsOpen"
          @close="topicsOpen = false"
          @select="chooseFromMenu" /></Teleport
    ></ClientOnly>
    <Sheet :open="overviewOpen" title="学习概览" minimal floating class="study-overview" @close="overviewOpen = false">
      <h2>{{ topic.name }}</h2>
      <div class="overview-meters">
        <div class="overview-meter-row">
          <div
            class="overview-meter"
            role="progressbar"
            aria-label="今日学习进度"
            :aria-valuenow="today"
            :aria-valuemax="dailyGoal"
            aria-valuemin="0"
          >
            <i :style="{ transform: `scaleX(${Math.min(1, today / dailyGoal)})` }" />
          </div>
          <small>{{ today }} / {{ dailyGoal }}</small>
        </div>
        <div class="overview-meter-row">
          <div
            class="overview-meter"
            role="progressbar"
            aria-label="主题总进度"
            :aria-valuenow="store.sdict.lastLearnIndex"
            :aria-valuemax="topic.length"
            aria-valuemin="0"
          >
            <i :style="{ transform: `scaleX(${topicProgress(topic.id)})` }" />
          </div>
          <small>{{ store.sdict.lastLearnIndex }} / {{ topic.length }}</small>
        </div>
      </div>
      <button class="overview-start" :aria-label="hasSession ? '继续学习' : '开始学习'" :disabled="busy" @click="start">
        <Icon name="play" />
      </button>
    </Sheet>
    <Sheet :open="vocabularyOpen" :title="topic.name" minimal class="vocabulary-sheet" @close="vocabularyOpen = false">
      <template #heading
        ><div class="vocabulary-heading">
          <h2>{{ topic.name }}</h2>
        </div></template
      >
      <Vocabulary :words="store.sdict.words" :open="vocabularyOpen" />
    </Sheet>
    <Sheet :open="!!wordDetails" :title="wordDetails?.word || ''" @close="wordDetails = null"
      ><template v-if="wordDetails"
        ><p class="detail-meaning">{{ wordDetails.trans.map(t => t.cn).join('；') }}</p>
        <button class="icon-button detail-sound" aria-label="播放发音" @click="speak(wordDetails.word)">
          <Icon name="sound" /></button
        ><button v-if="tab === 'wrong'" class="icon-button" aria-label="从错词本移出" @click="removeDetailedWord">
          <Icon name="remove" />
        </button>
        <div class="word-examples">
          <div v-for="s in wordDetails.sentences" :key="s.c">
            <p>{{ s.c }}</p>
            <p class="sheet-note">{{ s.cn }}</p>
          </div>
        </div>
        <p v-if="store.noteData[wordDetails.word]" class="sheet-note">
          {{ store.noteData[wordDetails.word] }}
        </p></template
      ></Sheet
    >
  </main>
</template>

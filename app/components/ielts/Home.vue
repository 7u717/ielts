<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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
import HomeDock from './HomeDock.vue'
import WordRow from './WordRow.vue'
import TopicMenu from './TopicMenu.vue'
import Vocabulary from './Vocabulary.vue'
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
const discY = ref(0)
function openOverview(event: MouseEvent) {
  const box = (event.currentTarget as HTMLElement).getBoundingClientRect()
  discY.value = box.y + box.height / 2
  overviewOpen.value = true
}
const topic = computed(() => topics.find(t => t.id === store.sdict.id) || topics[0])
const topicProgress = (id: string) => {
  const dict = store.word.bookList.find(d => d.id === id)
  return dict?.complete ? 1 : Math.min(1, (dict?.lastLearnIndex || 0) / (dict?.length || 24))
}
const menuProgress = computed(() => Object.fromEntries(topics.map(t => [t.id, topicProgress(t.id)])))
const review = computed(() => (store.load && !busy.value ? createStudyTask().taskWords.review : []))
const dueReviewCount = computed(() => (store.load && !busy.value ? createStudyTask().dueReviewCount : 0))
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
            :class="{ 'ring-expanded': overviewOpen }"
            :disabled="busy || !!error"
            :aria-label="hasSession ? '继续学习' : '开始学习'"
            aria-haspopup="dialog"
            @click="openOverview"
          >
            <Transition name="hero-theme" mode="out-in"
              ><Ring
                :key="topic.id"
                :progress="topicProgress(topic.id)"
                :review-progress="dueReviewCount / topic.length"
                :size="274"
                single
                ><span class="hero-topic">{{ topic.name }}</span></Ring
              ></Transition
            >
          </button>
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
        :class="{ 'wrong-panel': tab === 'wrong', 'empty-panel': !list.length }"
      >
        <div v-if="tab !== 'wrong' || list.length" class="list-heading" :class="{ 'wrong-heading': tab === 'wrong' }">
          <button v-if="tab !== 'wrong'" class="list-context" @click="topicsOpen = true">
            {{ topic.name }}<Icon v-if="tab === 'review'" name="down" /></button
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
    <HomeDock
      :tab="tab"
      :mode="mode"
      :disabled="busy"
      :vocabulary-label="topic.name + '词表'"
      @tab="tab = $event"
      @mode="chooseMode"
      @vocabulary="vocabularyOpen = true"
    />
    <ClientOnly
      ><Teleport to="#topic-menu-mount"
        ><TopicMenu
          :open="topicsOpen"
          :selected="topic.id"
          :topics="topics"
          :progress-values="menuProgress"
          :busy="busy"
          @toggle="topicsOpen = !topicsOpen"
          @close="topicsOpen = false"
          @select="chooseFromMenu" /></Teleport
    ></ClientOnly>
    <Sheet
      :open="overviewOpen"
      title="学习概览"
      minimal
      floating
      draggable
      class="study-overview ring-disc"
      :style="{ '--disc-y': discY + 'px' }"
      @close="overviewOpen = false"
    >
      <h2>{{ topic.name }}</h2>
      <div class="disc-progress">
        <Ring
          :progress="topicProgress(topic.id)"
          :review-progress="dueReviewCount / topic.length"
          :size="278"
          single
          :animate="false"
        />
        <span
          class="sr-only"
          role="progressbar"
          aria-label="本话题已学进度"
          :aria-valuenow="store.sdict.complete ? topic.length : store.sdict.lastLearnIndex"
          :aria-valuemax="topic.length"
          aria-valuemin="0"
        />
        <span
          class="sr-only"
          role="progressbar"
          aria-label="本话题待复习比例"
          :aria-valuenow="dueReviewCount"
          :aria-valuemax="topic.length"
          aria-valuemin="0"
        />
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

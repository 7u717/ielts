<script setup lang="ts">
import { inject, computed, ref, watch } from 'vue'
import { useBaseStore } from '@/core/stores/base'
import type { TaskWords } from '@/core/types'
import type { PracticeData } from '@/core/composables/practice-words/practice-word-session'
const data = inject<PracticeData>('practiceData')!
const task = inject<TaskWords>('practiceTaskWords')!
const store = useBaseStore()
const day = ref(new Date().toDateString())
const savedToday = computed(() =>
  (store.sdict.statistics || [])
    .filter(record => new Date(record.startDate).toDateString() === day.value)
    .reduce((sum, record) => sum + (record.new || 0), 0)
)
let baseline = savedToday.value
const seen = ref(new Set<string>())
watch(
  () => data.index,
  index => {
    const currentDay = new Date().toDateString()
    if (currentDay !== day.value) {
      day.value = currentDay
      seen.value.clear()
      baseline = savedToday.value
    }
    const newWords = new Set(task.new.map(word => word.word))
    for (const word of data.words.slice(0, index)) {
      if (newWords.has(word.word)) seen.value.add(word.word)
    }
  },
  { immediate: true, flush: 'sync' }
)
const goal = computed(() => Math.max(1, store.sdict.perDayStudyNumber))
const completed = computed(() => Math.min(goal.value, Math.max(savedToday.value, baseline + seen.value.size)))
defineEmits<{ skipStep: [] }>()
</script>
<template>
  <Teleport to="body"
    ><div
      class="practice-mini-progress"
      role="progressbar"
      aria-label="今日学习进度"
      :aria-valuenow="completed"
      :aria-valuemax="goal"
      aria-valuemin="0"
    >
      <i :style="{ transform: `scaleX(${completed / goal})` }" /></div
  ></Teleport>
</template>

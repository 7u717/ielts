<script setup lang="ts">
import { inject } from 'vue'
import type { PracticeData } from '@/core/composables/practice-words/practice-word-session'
const data = inject<PracticeData>('practiceData')!
defineEmits<{ skipStep: [] }>()
</script>
<template>
  <div
    class="practice-progress-a11y"
    role="progressbar"
    aria-label="本组学习进度"
    :aria-valuenow="data.index"
    :aria-valuemax="data.words.length"
    aria-valuemin="0"
  ></div>
</template>

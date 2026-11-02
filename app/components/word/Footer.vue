<script setup lang="ts">
import { inject } from 'vue'
import type { PracticeData } from '@/core/composables/practice-words/practice-word-session'
const data = inject<PracticeData>('practiceData')!
defineEmits<{ skipStep: [] }>()
</script>
<template>
  <div
    class="practice-mini-progress"
    role="progressbar"
    aria-label="本组学习进度"
    :aria-valuenow="data.index"
    :aria-valuemax="data.words.length"
    aria-valuemin="0"
  >
    <i :style="{ transform: `scaleX(${data.index / Math.max(1, data.words.length)})` }" />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
const props = withDefaults(
  defineProps<{
    progress: number
    reviewProgress?: number
    todayProgress?: number
    size?: number
    small?: boolean
    animate?: boolean
    single?: boolean
  }>(),
  { size: 230, animate: true }
)
const ratio = computed(() => Math.max(0, Math.min(1, props.progress || 0)))
const review = computed(() => Math.max(0, Math.min(1, props.reviewProgress || 0)))
const today = computed(() => Math.max(0, Math.min(1, props.todayProgress || 0)))
const todayCircumference = 2 * Math.PI * 103
const circumference = 2 * Math.PI * 110
const innerRadius = computed(() => (props.single ? 110 : 101))
const innerCircumference = computed(() => 2 * Math.PI * innerRadius.value)
// Due words are a subset of learned words; share one track without losing the due segment.
const learnedRatio = computed(() => (props.single ? Math.max(0, ratio.value - review.value) : ratio.value))
</script>
<template>
  <div
    class="iue-ring"
    :class="{
      small,
      'dual-ring': reviewProgress !== undefined,
      'ring-continuous': !animate,
      'ring-animate': animate,
      'ring-empty': ratio === 0 && review === 0,
    }"
    :style="{ width: size + 'px', height: size + 'px' }"
  >
    <svg viewBox="0 0 240 240" aria-hidden="true">
      <circle class="ring-track" cx="120" cy="120" r="110" />
      <circle
        v-if="learnedRatio > 0"
        class="ring-arc"
        cx="120"
        cy="120"
        r="110"
        :style="{ '--arc-length': circumference + 'px' }"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="circumference * (1 - learnedRatio)"
      />
      <template v-if="reviewProgress !== undefined">
        <circle v-if="!single" class="ring-track ring-review-track" cx="120" cy="120" r="101" />
        <circle
          v-if="review > 0"
          class="ring-arc ring-review-arc"
          cx="120"
          cy="120"
          :r="innerRadius"
          :transform="single ? `rotate(${learnedRatio * 360} 120 120)` : undefined"
          :style="{ '--arc-length': innerCircumference + 'px' }"
          :stroke-dasharray="innerCircumference"
          :stroke-dashoffset="innerCircumference * (1 - review)"
        />
      </template>
      <circle
        v-if="today > 0"
        class="ring-today-arc"
        cx="120"
        cy="120"
        r="103"
        :style="{ '--arc-length': todayCircumference + 'px' }"
        :stroke-dasharray="todayCircumference"
        :stroke-dashoffset="todayCircumference * (1 - today)"
      />
      <circle v-if="todayProgress !== undefined && today === 0" class="ring-today-start" cx="120" cy="17" r=".8" />
    </svg>
    <div class="ring-content"><slot /></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
const props = withDefaults(
  defineProps<{ progress: number; reviewProgress?: number; size?: number; small?: boolean; animate?: boolean }>(),
  { size: 230, animate: true }
)
const ratio = computed(() => Math.max(0, Math.min(1, props.progress || 0)))
const review = computed(() => Math.max(0, Math.min(1, props.reviewProgress || 0)))
const circumference = 2 * Math.PI * 110
const innerCircumference = 2 * Math.PI * 101
</script>
<template>
  <div
    class="iue-ring"
    :class="{ small, 'dual-ring': reviewProgress !== undefined, 'ring-continuous': !animate }"
    :style="{ width: size + 'px', height: size + 'px' }"
  >
    <svg viewBox="0 0 240 240" aria-hidden="true">
      <circle class="ring-track" cx="120" cy="120" r="110" />
      <circle
        v-if="ratio > 0"
        class="ring-arc"
        cx="120"
        cy="120"
        r="110"
        :style="{ '--arc-length': circumference + 'px' }"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="circumference * (1 - ratio)"
      />
      <template v-if="reviewProgress !== undefined">
        <circle class="ring-track ring-review-track" cx="120" cy="120" r="101" />
        <circle
          v-if="review > 0"
          class="ring-arc ring-review-arc"
          cx="120"
          cy="120"
          r="101"
          :style="{ '--arc-length': innerCircumference + 'px' }"
          :stroke-dasharray="innerCircumference"
          :stroke-dashoffset="innerCircumference * (1 - review)"
        />
      </template>
    </svg>
    <div class="ring-content"><slot /></div>
  </div>
</template>

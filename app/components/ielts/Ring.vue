<script setup lang="ts">
import { computed } from 'vue'
const props = withDefaults(defineProps<{ progress: number; size?: number; small?: boolean }>(), { size: 230 })
const ratio = computed(() => Math.max(0, Math.min(1, props.progress || 0)))
const radius = 110
const circumference = 2 * Math.PI * radius
const dot = computed(() => ({
  x: 120 + radius * Math.sin(ratio.value * 2 * Math.PI),
  y: 120 - radius * Math.cos(ratio.value * 2 * Math.PI),
}))
</script>
<template>
  <div class="iue-ring" :class="{ small }" :style="{ width: size + 'px', height: size + 'px' }">
    <svg viewBox="0 0 240 240" aria-hidden="true">
      <circle class="ring-track" cx="120" cy="120" :r="radius" />
      <circle
        v-if="ratio > 0"
        class="ring-arc"
        cx="120"
        cy="120"
        :r="radius"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="circumference * (1 - ratio)"
      />
      <circle v-if="!small && ratio > 0" class="ring-end-glow" :cx="dot.x" :cy="dot.y" r="4" />
    </svg>
    <div class="ring-content"><slot /></div>
  </div>
</template>

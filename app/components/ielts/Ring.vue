<script setup lang="ts">
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
const props = withDefaults(defineProps<{ progress: number; size?: number; small?: boolean }>(), { size: 220 })
const ratio = computed(() => Math.max(0, Math.min(1, props.progress || 0)))
const drawn = ref(0)
const circumference = 2 * Math.PI * 96
let frame = 0
onMounted(() => {
  frame = requestAnimationFrame(() => {
    frame = requestAnimationFrame(() => {
      drawn.value = ratio.value
    })
  })
})
watch(ratio, value => {
  drawn.value = value
})
onBeforeUnmount(() => cancelAnimationFrame(frame))
</script>
<template>
  <div class="iue-ring" :class="{ small }" :style="{ width: size + 'px', height: size + 'px' }">
    <svg viewBox="0 0 220 220" aria-hidden="true">
      <circle class="ring-track" cx="110" cy="110" r="96" />
      <circle
        class="ring-arc"
        cx="110"
        cy="110"
        r="96"
        :stroke-dasharray="circumference"
        :stroke-dashoffset="circumference * (1 - drawn)"
        :style="{ opacity: drawn > 0 ? 1 : 0 }"
      />
    </svg>
    <div class="ring-content"><slot /></div>
  </div>
</template>

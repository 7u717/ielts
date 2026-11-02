<script setup lang="ts">
defineProps<{ panelLeft: string }>()
</script>
<template>
  <div class="practice-shell">
    <div id="PracticeArea"><slot name="practice" /></div>
    <slot name="footer" />
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useInit } from '@/core/composables/useInit'
import WordCollectPopover from '@/components/word/WordCollectPopover.vue'
import Sheet from '@/components/ielts/Sheet.vue'
import Preferences from '@/components/ielts/Preferences.vue'
const init = useInit()
const route = useRoute()
const showPreferences = ref(false)
onMounted(() => { document.documentElement.className = 'dark'; void init() })
</script>
<template>
  <div class="ielts-app">
    <header class="app-header">
      <NuxtLink v-if="route.path.startsWith('/practice-words')" to="/" class="back-link" aria-label="保存并返回">←</NuxtLink>
      <NuxtLink v-else to="/" class="app-wordmark" aria-label="雅思学习首页">ielts<span>.</span></NuxtLink>
      <button class="preferences-button" aria-label="偏好设置" @click="showPreferences = true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 17h16" /><circle cx="9" cy="7" r="2" fill="var(--ielts-bg)" /><circle cx="15" cy="17" r="2" fill="var(--ielts-bg)" /></svg></button>
    </header>
    <slot />
    <Sheet :open="showPreferences" title="偏好" @close="showPreferences = false"><Preferences /></Sheet>
    <WordCollectPopover />
  </div>
</template>

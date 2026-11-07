<script setup lang="ts">
import { onMounted } from 'vue'
import { useInit } from '@/core/composables/useInit'
import { useBaseStore } from '@/core/stores/base'
import { focusPracticeKeyboard, haptic, useIeltsUI } from '@/core/ielts/ui'
import Icon from '@/components/ielts/Icon.vue'
import AvatarPreferences from '@/components/ielts/AvatarPreferences.vue'
const init = useInit()
const route = useRoute()
const store = useBaseStore()
const { preferencesOpen, tab } = useIeltsUI()
const practicing = computed(() => route.path.startsWith('/practice-words'))
onMounted(() => {
  document.documentElement.className = 'dark'
  void init()
})
function tap(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('button, a, select, summary')) haptic()
}
</script>
<template>
  <div class="ielts-app" data-design="iue-r3" @click.capture="tap">
    <header class="app-header">
      <NuxtLink v-if="practicing" to="/" class="avatar-button" aria-label="保存并返回"><Icon name="back" /></NuxtLink>
      <AvatarPreferences :enabled="!practicing" :anchor="practicing ? 'end' : 'start'" />
      <span class="header-title">{{
        practicing ? store.sdict.name : tab === 'wrong' ? '错词' : tab === 'review' ? '复习' : '雅思'
      }}</span>
      <div class="header-actions">
        <button v-if="practicing" class="icon-button" aria-label="打开键盘" @click="focusPracticeKeyboard">
          <Icon name="keyboard" />
        </button>
        <!-- Keep the Teleport target stable across lesson navigation. -->
        <div v-show="!practicing" id="topic-menu-mount" class="topic-menu-mount"></div>
        <button
          v-if="practicing"
          type="button"
          class="icon-button"
          data-open-preferences
          aria-label="偏好设置"
          aria-controls="preference-popover"
          :aria-expanded="preferencesOpen"
          @click="preferencesOpen = !preferencesOpen"
        >
          <Icon name="settings" />
        </button>
      </div>
    </header>
    <slot />
  </div>
</template>

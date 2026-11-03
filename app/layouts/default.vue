<script setup lang="ts">
import { onMounted } from 'vue'
import { useInit } from '@/core/composables/useInit'
import { useBaseStore } from '@/core/stores/base'
import { withAppBaseURL } from '@/core/utils/base-url'
import { focusPracticeKeyboard, haptic, useIeltsUI } from '@/core/ielts/ui'
import Sheet from '@/components/ielts/Sheet.vue'
import Icon from '@/components/ielts/Icon.vue'
import Preferences from '@/components/ielts/Preferences.vue'
import PracticeMenu from '@/components/ielts/PracticeMenu.vue'
const init = useInit()
const route = useRoute()
const store = useBaseStore()
const { preferencesOpen, tab } = useIeltsUI()
const practicing = computed(() => route.path.startsWith('/practice-words'))
onMounted(() => {
  void init()
})
function tap(e: MouseEvent) {
  if ((e.target as HTMLElement).closest('button, a, select, summary, [role=button]')) haptic()
}
</script>
<template>
  <div class="ielts-app" data-design="iue-r3" @click.capture="tap">
    <header class="app-header" :class="{ 'practice-header': practicing, 'home-header': !practicing }">
      <NuxtLink v-if="practicing" to="/" class="avatar-button" aria-label="保存并返回"><Icon name="back" /></NuxtLink>
      <button v-else class="avatar-button" aria-label="偏好设置" @click="preferencesOpen = true">
        <img :src="withAppBaseURL('/imgs/profile-avatar.jpg')" alt="" />
      </button>
      <span class="header-title">{{
        practicing ? store.sdict.name : tab === 'wrong' ? '错词' : tab === 'review' ? '复习' : '雅思'
      }}</span>
      <div class="header-actions">
        <PracticeMenu v-if="practicing" @keyboard="focusPracticeKeyboard" @preferences="preferencesOpen = true" />
        <!-- Keep the Teleport target stable across lesson navigation. -->
        <div v-show="!practicing" id="topic-menu-mount" class="topic-menu-mount"></div>
      </div>
    </header>
    <slot />
    <Sheet :open="preferencesOpen" title="偏好" minimal @close="preferencesOpen = false"><Preferences /> </Sheet>
  </div>
</template>

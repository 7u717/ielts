<script setup lang="ts">
import Sheet from '@/components/ielts/Sheet.vue'
import { emitter, EventKey } from '@/core/utils/eventBus'
const props = defineProps<{ loading?: boolean }>()
const model = defineModel({ default: false })
function continueStudy() { model.value = false; emitter.emit(EventKey.continueStudy) }
</script>
<template>
  <Sheet :open="model" title="这一组，记住了。" @close="model = false">
    <p class="sheet-note">{{ props.loading ? '正在保存学习记录…' : '学习记录已保存，下一次复习交给记忆曲线。' }}</p>
    <div class="completion-actions"><button class="primary-action" :disabled="props.loading" @click="continueStudy">再学一组 →</button><NuxtLink to="/" @click="model = false">今天到这里</NuxtLink></div>
  </Sheet>
</template>
<style scoped>
.completion-actions { display: grid; gap: 24px; text-align: center; margin-top: 32px; }
.completion-actions a { color: var(--ielts-muted); font-size: 13px; padding: 10px; text-decoration: none; }
</style>

<script setup lang="ts">
import { useSettingStore } from '@/core/stores/setting'
import { useBaseStore } from '@/core/stores/base'
import { useExport } from '@/core/hooks/export'
const settings = useSettingStore()
const store = useBaseStore()
const { exportData, loading } = useExport()
</script>
<template>
  <div class="preferences">
    <label>每日新词<select v-model.number="store.sdict.perDayStudyNumber"><option v-for="n in [5, 10, 15, 20]" :value="n">{{ n }} 个</option></select></label>
    <label>发音<select v-model="settings.soundType"><option value="uk">英式</option><option value="us">美式</option></select></label>
    <label>自动发音<input type="checkbox" v-model="settings.wordSound" /></label>
    <label>按键音<input type="checkbox" v-model="settings.keyboardSound" /></label>
    <label>答对自动继续<input type="checkbox" v-model="settings.autoNextWord" /></label>
    <button class="text-action" :disabled="loading" @click="exportData()">导出学习备份 ↗</button>
    <p class="sheet-note">进度仅存在此浏览器；换设备或清理浏览器前请导出备份。</p>
    <details><summary>添加到主屏幕</summary><p class="sheet-note">iPhone：在 Safari 中打开，点分享，再选「添加到主屏幕」。离线发音取决于系统已安装的英语语音。</p></details>
    <details><summary>关于</summary><p class="sheet-note">IELTS · 基于 <a href="https://github.com/zyronon/TypeWords" target="_blank" rel="noopener">TypeWords</a>（GPL-3.0）。六个话题的精选起步词库，不代表官方完整考纲。</p></details>
  </div>
</template>

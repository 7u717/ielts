<script setup lang="ts">
import { useSettingStore } from '@/core/stores/setting'
import { useBaseStore } from '@/core/stores/base'
import { useExport } from '@/core/hooks/export'
import Icon from './Icon.vue'
const settings = useSettingStore()
const store = useBaseStore()
const { exportData, loading } = useExport()
</script>
<template>
  <div class="preferences">
    <label
      >每日新词<select v-model.number="store.sdict.perDayStudyNumber">
        <option v-for="n in [5, 10, 15, 20]" :key="n" :value="n">{{ n }}</option>
      </select></label
    >
    <label
      >发音<select v-model="settings.soundType">
        <option value="uk">英式</option>
        <option value="us">美式</option>
      </select></label
    >
    <label>自动发音<input type="checkbox" v-model="settings.wordSound" /></label>
    <button class="preference-action" :disabled="loading" @click="exportData()">
      <span>导出备份</span><Icon name="export" />
    </button>
    <p class="sheet-note">学习记录保存在此设备，清理浏览器前请备份。</p>
    <details>
      <summary>添加到主屏幕</summary>
      <p class="sheet-note">在 Safari 中点分享，再选「添加到主屏幕」。</p>
    </details>
    <details>
      <summary>关于</summary>
      <p class="sheet-note">
        雅思话题精选词汇。基于
        <a href="https://github.com/zyronon/TypeWords" target="_blank" rel="noopener">TypeWords</a>，遵循
        GPL-3.0；不代表官方完整词表。
      </p>
    </details>
  </div>
</template>

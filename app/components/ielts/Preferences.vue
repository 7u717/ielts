<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSettingStore } from '@/core/stores/setting'
import { useBaseStore } from '@/core/stores/base'
import { haptic } from '@/core/ielts/ui'
const settings = useSettingStore()
const store = useBaseStore()
// Keep a previously saved goal (including 5/15) selectable without migrating it.
const legacyGoal = ref(store.sdict.perDayStudyNumber)
watch(
  () => store.sdict.id,
  () => {
    legacyGoal.value = store.sdict.perDayStudyNumber
  }
)
const goals = computed(() => [...new Set([10, 20, 30, 40, legacyGoal.value])].filter(n => n > 0).sort((a, b) => a - b))
const index = computed(() => Math.max(0, goals.value.indexOf(store.sdict.perDayStudyNumber)))
function setGoal(event: Event) {
  const goal = goals.value[Number((event.target as HTMLInputElement).value)]
  if (goal && goal !== store.sdict.perDayStudyNumber) {
    store.sdict.perDayStudyNumber = goal
    haptic()
  }
}
function toggleSound() {
  settings.wordSound = !settings.wordSound
}
</script>
<template>
  <div class="preferences focused-preferences">
    <section class="daily-goal">
      <span class="preference-label">每日新词</span>
      <div class="goal-dial" :style="{ '--goal-fill': (index / Math.max(1, goals.length - 1)) * 100 + '%' }">
        <input
          id="daily-goal-dial"
          type="range"
          min="0"
          :max="goals.length - 1"
          step="1"
          :value="index"
          aria-label="每日新词"
          :aria-valuetext="store.sdict.perDayStudyNumber + ' 个'"
          @input="setGoal"
        />
      </div>
      <output for="daily-goal-dial" class="goal-value">{{ store.sdict.perDayStudyNumber }} <span>词 / 天</span></output>
    </section>
    <section class="automatic-sound">
      <span class="preference-label">自动发音</span
      ><button
        type="button"
        class="quiet-switch"
        role="switch"
        aria-label="自动发音"
        :aria-checked="settings.wordSound"
        @click="toggleSound"
      >
        <span /><i />
      </button>
    </section>
  </div>
</template>

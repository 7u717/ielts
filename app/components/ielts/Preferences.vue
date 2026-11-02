<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSettingStore } from '@/core/stores/setting'
import { useBaseStore } from '@/core/stores/base'
import { haptic } from '@/core/ielts/ui'
const settings = useSettingStore()
const store = useBaseStore()
// Existing targets remain selectable without migrating or rounding saved data.
const legacyGoal = ref(store.sdict.perDayStudyNumber)
watch(
  () => store.sdict.id,
  () => {
    legacyGoal.value = store.sdict.perDayStudyNumber
  }
)
const goals = computed(() => [...new Set([10, 20, 30, 40, legacyGoal.value])].filter(n => n > 0).sort((a, b) => a - b))
const index = computed(() => Math.max(0, goals.value.indexOf(store.sdict.perDayStudyNumber)))
const position = ref(index.value)
const dragging = ref(false)
watch(index, value => {
  if (!dragging.value) position.value = value
})
const progress = computed(() => (position.value / Math.max(1, goals.value.length - 1)) * 100)
const preview = computed(() => {
  const lower = Math.floor(position.value)
  const a = goals.value[lower] ?? goals.value[0]
  const b = goals.value[Math.min(lower + 1, goals.value.length - 1)]
  return Math.round(a + (b - a) * (position.value - lower))
})
let lastStop = index.value
function start() {
  dragging.value = true
  lastStop = index.value
}
function input(event: Event) {
  position.value = Number((event.target as HTMLInputElement).value)
  const stop = Math.round(position.value)
  if (stop !== lastStop) {
    haptic()
    lastStop = stop
  }
}
function commit() {
  const stop = Math.max(0, Math.min(goals.value.length - 1, Math.round(position.value)))
  position.value = stop
  dragging.value = false
  if (store.sdict.perDayStudyNumber !== goals.value[stop]) {
    store.sdict.perDayStudyNumber = goals.value[stop]
    haptic()
  }
}
function cancel() {
  dragging.value = false
  position.value = index.value
}
function key(event: KeyboardEvent) {
  const direction = ['ArrowRight', 'ArrowUp'].includes(event.key)
    ? 1
    : ['ArrowLeft', 'ArrowDown'].includes(event.key)
      ? -1
      : 0
  if (!direction && !['Home', 'End'].includes(event.key)) return
  event.preventDefault()
  position.value =
    event.key === 'Home'
      ? 0
      : event.key === 'End'
        ? goals.value.length - 1
        : Math.max(0, Math.min(goals.value.length - 1, Math.round(position.value) + direction))
  commit()
}
</script>
<template>
  <div class="preferences focused-preferences">
    <section class="daily-goal">
      <div class="goal-heading">
        <label for="daily-goal-dial" class="preference-label">每日新词</label>
        <output for="daily-goal-dial" class="goal-value" :class="{ quiet: dragging }"
          ><span class="goal-number-wrap"
            ><Transition name="goal-digit"
              ><span class="goal-number" :key="store.sdict.perDayStudyNumber">{{
                store.sdict.perDayStudyNumber
              }}</span></Transition
            ></span
          ><span>词 / 天</span></output
        >
      </div>
      <div class="goal-dial" :class="{ dragging }" :style="{ '--goal-position': progress + '%' }">
        <div class="goal-track" aria-hidden="true">
          <div class="goal-ticks"><i v-for="goal in goals" :key="goal" /></div>
          <span class="goal-cursor"
            ><span class="goal-floating-value"
              ><Transition name="goal-digit"
                ><span :key="preview" class="goal-number">{{ preview }}</span></Transition
              ></span
            ></span
          >
        </div>
        <input
          id="daily-goal-dial"
          type="range"
          min="0"
          :max="goals.length - 1"
          step="0.01"
          :value="position"
          aria-label="每日新词"
          :aria-valuetext="preview + ' 个'"
          @pointerdown="start"
          @input="input"
          @change="commit"
          @pointerup="commit"
          @pointercancel="cancel"
          @keydown="key"
        />
      </div>
    </section>
    <button
      type="button"
      class="automatic-sound"
      role="switch"
      aria-label="自动发音"
      :aria-checked="settings.wordSound"
      @click="settings.wordSound = !settings.wordSound"
    >
      <span class="preference-label">自动发音</span>
      <span class="quiet-switch" aria-hidden="true"><i /></span>
    </button>
  </div>
</template>

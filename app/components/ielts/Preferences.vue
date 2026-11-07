<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useSettingStore } from '@/core/stores/setting'
import { useBaseStore } from '@/core/stores/base'
import { haptic } from '@/core/ielts/ui'
import { GOAL_RANGE_MIN, GOAL_RANGE_STEP, goalIndex, goalRangeMax, nearestStop, uniformStep } from '@/core/ielts/daily-goal'
import { useGoalStops } from '@/core/ielts/goal-stops'

const props = defineProps<{ preview?: number | null; locked?: boolean }>()
const settings = useSettingStore()
const store = useBaseStore()
const { stops } = useGoalStops()
const uid = useId()
const numberId = `daily-goal-number-${uid}`
const dialId = `daily-goal-dial-${uid}`
const soundId = `auto-sound-${uid}`
const numberInput = ref<HTMLInputElement>()
const numberFocused = ref(false)
const shown = computed(() => {
  const value = props.preview ?? store.sdict.perDayStudyNumber
  return stops.value.includes(value) ? value : nearestStop(stops.value, value)
})
const index = computed(() => goalIndex(stops.value, shown.value))
const fill = computed(() => (index.value / Math.max(1, stops.value.length - 1)) * 100)
const step = computed(() => uniformStep(stops.value))
const minGoal = computed(() => stops.value[0] ?? 1)
const maxGoal = computed(() => stops.value[stops.value.length - 1] ?? minGoal.value)

watch(shown, value => {
  if (numberFocused.value || !numberInput.value) return
  numberInput.value.value = String(value)
})

function commit(goal: number) {
  if (props.locked) return
  const next = nearestStop(stops.value, goal)
  if (next > 0 && next !== store.sdict.perDayStudyNumber) {
    store.sdict.perDayStudyNumber = next
    haptic()
  }
  return next
}
function fromRange(event: Event) {
  const next = stops.value[Number((event.target as HTMLInputElement).value)]
  if (next) commit(next)
}
function fromNumber(event: Event) {
  const input = event.target as HTMLInputElement
  const raw = Number(input.value)
  const next = Number.isFinite(raw) ? commit(raw) : shown.value
  input.value = String(next || shown.value)
}
function toggleSound() {
  if (props.locked) return
  settings.wordSound = !settings.wordSound
  haptic()
}
</script>
<template>
  <div class="preferences focused-preferences">
    <section class="daily-goal">
      <label class="preference-label" :for="numberId">每日新词</label>
      <div class="goal-readout" :aria-live="locked ? 'polite' : 'off'">
        <input
          :id="numberId"
          ref="numberInput"
          class="goal-number"
          type="number"
          inputmode="numeric"
          autocomplete="off"
          :min="minGoal"
          :max="maxGoal"
          :step="step"
          :value="shown"
          :readonly="locked"
          :style="{ '--digits': String(shown).length }"
          aria-label="每日新词数量"
          @focus="numberFocused = true"
          @blur="numberFocused = false"
          @change="fromNumber"
        />
        <span class="goal-unit">词/天</span>
      </div>
      <div class="goal-dial" :style="{ '--goal-fill': fill + '%' }">
        <input
          :id="dialId"
          type="range"
          :min="GOAL_RANGE_MIN"
          :max="goalRangeMax(stops.length)"
          :step="GOAL_RANGE_STEP"
          :value="index"
          aria-label="每日新词"
          :aria-valuetext="shown + ' 词每天'"
          @input="fromRange"
        />
      </div>
    </section>
    <section class="automatic-sound">
      <span :id="soundId" class="preference-label">自动发音</span>
      <button
        type="button"
        class="quiet-switch"
        role="switch"
        :aria-labelledby="soundId"
        :aria-checked="settings.wordSound"
        @click="toggleSound"
      >
        <span /><i />
      </button>
    </section>
  </div>
</template>

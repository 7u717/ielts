import { computed, watch } from 'vue'
import { useBaseStore } from '@/core/stores/base'
import { goalStops } from './daily-goal'

// Remember the goal loaded for each dictionary so choosing another stop does
// not drop a previously saved 5/15 from the slider during this visit.
export function useGoalStops() {
  const store = useBaseStore()
  const legacyByDict = useState<Record<string, number>>('ielts-daily-goal-legacy', () => ({}))
  watch(
    () => [store.load, store.sdict.id] as const,
    ([loaded, id]) => {
      if (!loaded || id == null || id === '') return
      const key = String(id)
      if (legacyByDict.value[key] == null) {
        legacyByDict.value = { ...legacyByDict.value, [key]: store.sdict.perDayStudyNumber }
      }
    },
    { immediate: true }
  )
  const stops = computed(() => {
    const key = String(store.sdict.id ?? '')
    return goalStops(legacyByDict.value[key] ?? store.sdict.perDayStudyNumber)
  })
  return { stops }
}

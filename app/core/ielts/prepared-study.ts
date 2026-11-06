import { effectScope, reactive } from 'vue'
import { shuffle } from '@/core/utils'
import type { Word } from '@/core/types'
import { useBaseStore } from '@/core/stores/base'
import {
  usePracticeWordSession,
  type PracticeWordSessionOptions,
} from '@/core/composables/practice-words/usePracticeWordSession'
import { getDefaultPracticeData, type PracticeWordCache } from '@/core/composables/practice-words/practice-word-session'

// One-shot, in-memory handoff. Never persisted or shared across identities.
let prepared: {
  id: string | number
  session: ReturnType<typeof usePracticeWordSession>
  data: ReturnType<typeof getDefaultPracticeData>
  task: PracticeWordCache['taskWords']
  allWords: Word[]
  scope: ReturnType<typeof effectScope>
  bind: (next: PracticeWordSessionOptions) => void
} | null = null
export function prepareStudy(cache: PracticeWordCache) {
  prepared?.scope.stop()
  prepared = null
  const scope = effectScope(true)
  const allWords = shuffle(useBaseStore().sdict.words)
  let data = reactive(getDefaultPracticeData())
  const task = reactive({ new: [], review: [] } as PracticeWordCache['taskWords'])
  let callbacks: Partial<PracticeWordSessionOptions> = {}
  const session = scope.run(() =>
    usePracticeWordSession({
      provideContext: false,
      getPracticeData: () => callbacks.getPracticeData?.() ?? data,
      setPracticeData: value => {
        data = value
        callbacks.setPracticeData?.(value)
      },
      getTaskWords: () => callbacks.getTaskWords?.() ?? task,
      getAllWords: () => callbacks.getAllWords?.() ?? allWords,
      complete: () => callbacks.complete?.(),
      scheduleSave: () => callbacks.scheduleSave?.(),
      notify: (level, message) => callbacks.notify?.(level, message),
    })
  )!
  if (!session.applyPracticeCache(cache) && !session.initializeTask(cache.taskWords)) {
    scope.stop()
    throw new Error('Empty study session')
  }
  prepared = {
    id: useBaseStore().sdict.id,
    session,
    data,
    task,
    allWords,
    scope,
    bind: next => {
      callbacks = next
    },
  }
}
export function takePreparedStudy(id: string | number) {
  const result = prepared
  prepared = null
  if (result?.id === id) return result
  result?.scope.stop()
  return null
}

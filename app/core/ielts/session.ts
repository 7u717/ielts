import { get, set } from 'idb-keyval'
import { useBaseStore } from '@/core/stores/base'
import { useSettingStore } from '@/core/stores/setting'
import { _getDictDataByUrl } from '@/core/utils'
import { PRACTICE_WORD_CACHE, setPracticeWordCacheLocal } from '@/core/utils/cache'
import { useDataSyncPersistence } from '@/core/composables/useDataSyncPersistence'
import type { Dict, DictResource } from '@/core/types'

// Keep each dictionary's unfinished session, including legacy dictionaries.
export async function selectTopic(topic: DictResource) {
  const store = useBaseStore()
  const saved = store.word.bookList.find(item => item.id === topic.id)
  const loaded = await _getDictDataByUrl(topic)
  if (loaded.words.length !== topic.length) throw new Error('词库未完整加载，请重试')
  await switchSession(topic.id)
  // Overlay progress only after loading resources; never replace it with defaults.
  await store.changeDict({ ...loaded, ...saved, words: loaded.words, length: loaded.words.length })
  await useDataSyncPersistence().saveDictState()
}

async function switchSession(targetId: string | number, context: string | number = targetId) {
  const store = useBaseStore()
  const settings = useSettingStore()
  const currentId = store.sdict.id
  const currentContext = (await get('ielts-session-context')) ?? currentId
  if (currentId === targetId && currentContext === context) return
  if (currentId) {
    await set(`ielts-session:${currentContext}`, {
      cache: await get(PRACTICE_WORD_CACHE.key),
      mode: settings.wordPracticeMode,
    })
  }
  const archived = await get(`ielts-session:${context}`)
  if (archived?.cache) await set(PRACTICE_WORD_CACHE.key, archived.cache)
  else await setPracticeWordCacheLocal(null, new Date().toISOString())
  if (typeof archived?.mode === 'number') settings.wordPracticeMode = archived.mode
  await set('ielts-session-context', context)
}

export async function selectSavedDictionary(dict: Dict) {
  await switchSession(dict.id)
  await useBaseStore().changeDict({ ...dict, words: [...dict.words] })
  await useDataSyncPersistence().saveDictState()
}

export async function selectReviewSession() {
  const id = useBaseStore().sdict.id
  await switchSession(id, `${id}:review`)
}

export async function selectModeSession(mode: number) {
  const id = useBaseStore().sdict.id
  const context = mode === 1 ? `${id}:typing` : mode === 4 ? `${id}:listening` : id
  await switchSession(id, context)
}

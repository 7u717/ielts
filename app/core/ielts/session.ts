import { get, set } from 'idb-keyval'
import { useBaseStore } from '@/core/stores/base'
import { useSettingStore } from '@/core/stores/setting'
import { _getDictDataByUrl } from '@/core/utils'
import { PRACTICE_WORD_CACHE, setPracticeWordCacheLocal } from '@/core/utils/cache'
import { useDataSyncPersistence } from '@/core/composables/useDataSyncPersistence'
import type { DictResource } from '@/core/types'

// Keep each dictionary's unfinished session, including legacy dictionaries.
export async function selectTopic(topic: DictResource) {
  const store = useBaseStore()
  const settings = useSettingStore()
  const currentId = store.sdict.id
  const saved = store.word.bookList.find(item => item.id === topic.id)
  const loaded = await _getDictDataByUrl(topic)
  if (loaded.words.length !== topic.length) throw new Error('词库未完整加载，请重试')
  if (currentId !== topic.id) {
    if (currentId) {
      await set(`ielts-session:${currentId}`, {
        cache: await get(PRACTICE_WORD_CACHE.key),
        mode: settings.wordPracticeMode,
      })
    }
    const archived = await get(`ielts-session:${topic.id}`)
    if (archived?.cache) await set(PRACTICE_WORD_CACHE.key, archived.cache)
    else await setPracticeWordCacheLocal(null, new Date().toISOString())
    if (archived?.mode) settings.wordPracticeMode = archived.mode
  }
  // Overlay progress only after loading resources; never replace it with defaults.
  await store.changeDict({ ...loaded, ...saved, words: loaded.words, length: loaded.words.length })
  await useDataSyncPersistence().saveDictState()
}

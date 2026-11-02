import { unlockPronunciation, resetPronunciationGesture } from '@/core/ielts/pronunciation'
export default defineNuxtPlugin(nuxtApp => {
  const unlock = (event: Event) => {
    if (event.isTrusted) unlockPronunciation()
  }
  const hidden = () => {
    if (document.hidden) resetPronunciationGesture()
  }
  // The capture phase runs before async navigation, timers or word loading.
  document.addEventListener('touchend', unlock, { capture: true, passive: true })
  document.addEventListener('click', unlock, true)
  document.addEventListener('keydown', unlock, true)
  document.addEventListener('visibilitychange', hidden)
  nuxtApp.vueApp.onUnmount(() => {
    document.removeEventListener('touchend', unlock, true)
    document.removeEventListener('click', unlock, true)
    document.removeEventListener('keydown', unlock, true)
    document.removeEventListener('visibilitychange', hidden)
  })
})

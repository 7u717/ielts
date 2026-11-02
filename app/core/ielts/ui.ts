export type IeltsTab = 'learn' | 'wrong' | 'review'
export function useIeltsUI() {
  return {
    tab: useState<IeltsTab>('ielts-ui-tab', () => 'learn'),
    topicsOpen: useState('ielts-ui-topics', () => false),
    preferencesOpen: useState('ielts-ui-preferences', () => false),
  }
}
let lastHaptic = 0
export function haptic() {
  if (typeof navigator === 'undefined') return
  if (Date.now() - lastHaptic < 70) return
  lastHaptic = Date.now()
  try {
    navigator.vibrate?.(8)
  } catch {
    /* Optional on iOS. */
  }
}
export function focusPracticeKeyboard() {
  ;(document.querySelector('#typing-listener') as HTMLInputElement | null)?.focus()
}

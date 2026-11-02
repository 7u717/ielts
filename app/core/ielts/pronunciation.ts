/** One persistent media element, primed during a real gesture for iOS Safari/PWA.
 * No fetch/Web Audio graph/crossOrigin attribute: ordinary HTTPS media playback
 * does not require the dictionary server to grant fetch CORS access.
 */
export interface PronunciationOptions {
  manual?: boolean
  rate?: number
  volume?: number
  onPlay?: () => void
  onEnd?: () => void
  onError?: () => void
}
type Request = {
  word: string
  options: PronunciationOptions
  stage: 'audio' | 'speech'
  started: boolean
  timer?: ReturnType<typeof setTimeout>
}
let media: HTMLAudioElement | null = null
let active: Request | null = null
let pending: Request | null = null
let gestured = false
let mediaReady = false
let primingMedia = false
let speechPrimed = false
const SILENCE =
  'data:audio/wav;base64,UklGRiQFAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAFAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=='
export function pronunciationURL(word: string) {
  return `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word.trim())}&type=1`
}
function audio() {
  if (!media && typeof document !== 'undefined') {
    media = document.createElement('audio')
    media.id = 'ielts-word-audio'
    media.preload = 'auto'
    media.hidden = true
    media.setAttribute('playsinline', '')
    media.setAttribute('webkit-playsinline', '')
    media.setAttribute('aria-hidden', 'true')
    document.body.appendChild(media)
  }
  return media
}
function clearMediaEvents() {
  if (!media) return
  media.onplaying = media.onended = media.onerror = media.onstalled = null
}
function pauseMedia() {
  if (!media) return
  media.pause()
  if (media.readyState > 0) {
    try {
      media.currentTime = 0
    } catch {
      /* Safari may not have seekable data yet. */
    }
  }
}
function primeSpeech() {
  if (speechPrimed || typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') return
  try {
    speechSynthesis.resume()
    const unlock = new SpeechSynthesisUtterance('a')
    unlock.lang = 'en-GB'
    unlock.volume = 0
    unlock.onerror = () => {
      speechPrimed = false
    }
    speechSynthesis.speak(unlock) // Must be synchronous with the user event, not voiceschanged/await.
    speechPrimed = true
  } catch {
    speechPrimed = false
  }
}
function started(request: Request) {
  if (active !== request) return
  clearTimeout(request.timer)
  if (!request.started) {
    request.started = true
    request.options.onPlay?.()
  }
}
function finish(request: Request) {
  if (active !== request) return
  clearTimeout(request.timer)
  clearMediaEvents()
  active = null
  request.options.onEnd?.()
}
function failed(request: Request, retryOnGesture = false) {
  if (active !== request) return
  clearTimeout(request.timer)
  clearMediaEvents()
  active = null
  if (retryOnGesture) {
    gestured = false
    speechPrimed = false
    mediaReady = false
    if (!request.options.manual) {
      request.stage = 'audio'
      request.started = false
      pending = request
    }
  }
  if (typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
  request.options.onError?.()
}
function speechFallback(request: Request) {
  if (active !== request || request.stage === 'speech') return
  request.stage = 'speech'
  clearTimeout(request.timer)
  clearMediaEvents()
  pauseMedia()
  if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') {
    failed(request)
    return
  }
  try {
    const msg = new SpeechSynthesisUtterance(request.word)
    msg.lang = 'en-GB'
    msg.rate = request.options.rate ?? 1
    msg.volume = request.options.volume ?? 1
    const voice = speechSynthesis.getVoices().find(v => v.lang.replace('_', '-').toLowerCase().startsWith('en-gb'))
    if (voice) msg.voice = voice // Otherwise let en-GB select the system voice, never force an en-US voice.
    msg.onstart = () => started(request)
    msg.onend = () => finish(request)
    msg.onerror = event => failed(request, event.error === 'not-allowed')
    speechSynthesis.cancel()
    speechSynthesis.resume()
    request.timer = setTimeout(() => failed(request, true), 3000)
    speechSynthesis.speak(msg)
  } catch {
    failed(request, true)
  }
}
function play(request: Request) {
  const player = audio()
  active = request
  request.stage = 'audio'
  if (!player) {
    speechFallback(request)
    return
  }
  clearMediaEvents()
  player.onplaying = () => {
    mediaReady = true
    started(request)
  }
  player.onended = () => finish(request)
  player.onerror = () => speechFallback(request)
  player.onstalled = () => {
    if (request.started) speechFallback(request)
  }
  try {
    player.muted = false
    player.volume = request.options.volume ?? 1
    player.playbackRate = request.options.rate ?? 1
    player.src = pronunciationURL(request.word)
    request.timer = setTimeout(() => speechFallback(request), 3000)
    const result = player.play() // No await before play(): manual requests retain the trusted event.
    result
      ?.then(() => {
        if (active === request && request.stage === 'audio') {
          mediaReady = true
          started(request)
        }
      })
      .catch(error => {
        if (active !== request || request.stage !== 'audio') return
        if (error?.name === 'NotAllowedError') mediaReady = false
        speechFallback(request)
      })
  } catch {
    speechFallback(request)
  }
}
/** Called synchronously by click/touchend/keydown, including the home Start tap. */
export function unlockPronunciation() {
  gestured = true
  primeSpeech()
  if (pending) {
    const request = pending
    pending = null
    play(request)
    return
  }
  if (mediaReady || primingMedia || active) return
  const player = audio()
  if (!player) return
  primingMedia = true
  clearMediaEvents()
  player.src = SILENCE
  player.muted = false
  player.volume = 1
  try {
    const result = player.play()
    Promise.resolve(result)
      .then(() => {
        primingMedia = false
        mediaReady = true
        if (player.src === SILENCE) player.pause()
        if (pending) {
          const request = pending
          pending = null
          play(request)
        }
      })
      .catch(() => {
        primingMedia = false
        if (pending) {
          const request = pending
          pending = null
          active = request
          speechFallback(request)
        }
      })
  } catch {
    primingMedia = false
  }
}
export function cancelPronunciation() {
  pending = null
  const previous = active
  active = null
  if (!previous) return // Do not cancel an in-flight silent unlock while a lesson mounts.
  clearTimeout(previous.timer)
  clearMediaEvents()
  pauseMedia()
  if (previous.stage === 'speech' && typeof speechSynthesis !== 'undefined') speechSynthesis.cancel()
}
export function playPronunciation(word: string, options: PronunciationOptions = {}) {
  word = word.trim()
  if (!word) return
  cancelPronunciation()
  const request: Request = { word, options, stage: 'audio', started: false }
  if (options.manual) {
    gestured = true
    primeSpeech()
  }
  if (!gestured || (!options.manual && primingMedia && !mediaReady)) {
    pending = request
    return
  }
  play(request)
}
export function resetPronunciationGesture() {
  cancelPronunciation()
  gestured = false
  mediaReady = false
  speechPrimed = false
}

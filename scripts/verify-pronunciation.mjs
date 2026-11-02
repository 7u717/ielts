import assert from 'node:assert/strict'
import { setTimeout as wait } from 'node:timers/promises'
let counter = 0
async function setup({ failAudio = false, rejectPlay = false, stallAudio = false, failSpeech = false } = {}) {
  const played = [],
    spoken = [],
    created = [],
    callbacks = []
  let gesture = false,
    speechPermission = false
  class Media {
    constructor() {
      this.src = ''
      this.readyState = 0
      this.allowed = false
      this.attrs = {}
      this.volume = 1
      this.muted = false
    }
    setAttribute(key, value) {
      this.attrs[key] = value
    }
    pause() {}
    play() {
      played.push({ src: this.src, gesture, element: this })
      if (gesture) this.allowed = true
      if (!this.allowed || rejectPlay)
        return Promise.reject(Object.assign(new Error('gesture required'), { name: 'NotAllowedError' }))
      if (stallAudio && this.src.startsWith('https:')) return new Promise(() => {})
      if (failAudio && this.src.startsWith('https:')) {
        queueMicrotask(() => this.onerror?.())
        return Promise.reject(new Error('network error'))
      }
      queueMicrotask(() => this.onplaying?.())
      return Promise.resolve()
    }
  }
  globalThis.document = {
    createElement: tag => {
      assert.equal(tag, 'audio')
      const media = new Media()
      created.push(media)
      return media
    },
    body: { appendChild() {} },
  }
  globalThis.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text
    }
  }
  globalThis.speechSynthesis = {
    resume() {},
    cancel() {},
    getVoices: () => [
      { name: 'US', lang: 'en-US' },
      { name: 'UK', lang: 'en-GB' },
    ],
    speak(msg) {
      if (gesture) speechPermission = true
      spoken.push({ text: msg.text, lang: msg.lang, voice: msg.voice?.lang, volume: msg.volume, gesture })
      callbacks.push(msg)
      queueMicrotask(() => {
        if (!speechPermission || failSpeech) msg.onerror?.({ error: 'not-allowed' })
        else msg.onstart?.()
      })
    },
  }
  const api = await import(`../app/core/ielts/pronunciation.ts?case=${++counter}`)
  return {
    api,
    played,
    spoken,
    created,
    callbacks,
    gesture(fn) {
      gesture = true
      try {
        return fn()
      } finally {
        gesture = false
      }
    },
  }
}
{
  const test = await setup()
  test.api.playPronunciation('environment')
  assert.equal(test.played.length, 0, 'automatic pronunciation waits for the first gesture')
  test.gesture(() => test.api.unlockPronunciation())
  await wait(0)
  assert.equal(test.played.at(-1).gesture, true)
  assert.equal(test.played.at(-1).src, 'https://dict.youdao.com/dictvoice?audio=environment&type=1')
  assert.equal(test.created.length, 1)
  assert.equal(test.created[0].attrs.playsinline, '')
  assert.ok(!('crossOrigin' in test.created[0]), 'media is not forced into CORS mode')
  test.api.cancelPronunciation()
  console.log('PASS: first-gesture queue, HTTPS UK source, inline media without fetch CORS')
}
{
  const test = await setup()
  test.gesture(() => test.api.unlockPronunciation())
  test.api.cancelPronunciation() // Lesson mounts while the silent play promise is pending.
  test.api.playPronunciation('education')
  await wait(0)
  assert.ok(test.played[0].src.startsWith('data:audio/wav;base64,'))
  assert.ok(test.played.at(-1).src.includes('education'))
  assert.equal(test.played.at(-1).gesture, false, 'later automatic play is outside the gesture')
  assert.equal(test.created.length, 1, 'the already unlocked media element is reused')
  test.api.playPronunciation('technology')
  await wait(0)
  assert.equal(test.created.length, 1)
  assert.ok(test.played.at(-1).src.includes('technology'))
  test.api.cancelPronunciation()
  console.log('PASS: silent media warm-up survives mounting; later words reuse the unlocked element')
}
{
  const test = await setup({ failAudio: true })
  let ended = 0
  test.gesture(() => test.api.unlockPronunciation())
  await wait(0)
  test.api.playPronunciation('sustainability', { onEnd: () => ended++ })
  await wait(0)
  const spoken = test.spoken.filter(s => s.volume !== 0)
  assert.equal(spoken.length, 1, 'network event and rejected play promise only fall back once')
  assert.equal(spoken[0].lang, 'en-GB')
  assert.equal(spoken[0].voice, 'en-GB')
  assert.equal(spoken[0].gesture, false, 'primed speech can recover a later asynchronous failure')
  test.callbacks.at(-1).onend()
  assert.equal(ended, 1)
  console.log('PASS: dictionary network failure -> one en-GB fallback with a real completion callback')
}
{
  const test = await setup({ rejectPlay: true })
  test.gesture(() => test.api.playPronunciation('habitat', { manual: true }))
  await wait(0)
  assert.ok(test.spoken.some(s => s.text === 'habitat' && s.lang === 'en-GB'))
  test.api.cancelPronunciation()
  console.log('PASS: NotAllowedError on HTML audio falls back to gesture-primed British speech')
}
{
  const test = await setup()
  let ended = 0
  test.gesture(() => test.api.playPronunciation('old', { manual: true, onEnd: () => ended++ }))
  await wait(0)
  const oldEnded = test.created[0].onended
  test.gesture(() => test.api.playPronunciation('new', { manual: true }))
  oldEnded()
  assert.equal(ended, 0, 'old callbacks cannot advance or chain audio after a word change')
  assert.equal(
    test.api.pronunciationURL('public health'),
    'https://dict.youdao.com/dictvoice?audio=public%20health&type=1'
  )
  test.api.cancelPronunciation()
  test.api.resetPronunciationGesture()
  const count = test.played.length
  test.api.playPronunciation('resumed')
  assert.equal(test.played.length, count, 'a new foreground session waits for a new gesture')
  test.api.cancelPronunciation()
  console.log('PASS: stale callbacks are ignored, source words encoded, background resume requires a fresh gesture')
}
{
  const test = await setup({ failAudio: true, failSpeech: true })
  let ended = 0,
    errors = 0
  test.gesture(() =>
    test.api.playPronunciation('test', { manual: true, onEnd: () => ended++, onError: () => errors++ })
  )
  await wait(0)
  assert.equal(ended, 0, 'a speech failure is never reported as successful playback')
  assert.equal(errors, 1)
  test.api.cancelPronunciation()
  console.log('PASS: both playback failures report failure, never success')
}

{
  const test = await setup({ stallAudio: true })
  test.gesture(() => test.api.playPronunciation('timeout', { manual: true }))
  await wait(3100)
  assert.ok(test.spoken.some(s => s.text === 'timeout' && s.lang === 'en-GB'))
  test.api.cancelPronunciation()
  console.log('PASS: a stalled media source falls back instead of remaining silent indefinitely')
}

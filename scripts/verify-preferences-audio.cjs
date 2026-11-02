const { headerAction } = require('./mobile-actions.cjs')
// Real Chromium media playback against a local WAV fixture at the HTTPS dictionary URL.
// This verifies playback/gesture plumbing, not external Youdao availability or physical iPhone output.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const base = process.env.IELTS_TEST_URL || 'http://127.0.0.1:4173/ielts/'
const output = process.env.IELTS_SCREENSHOTS || '/tmp/ielts-preferences-audio'
fs.mkdirSync(output, { recursive: true })
// 80ms PCM WAV. No CORS headers are supplied by the route.
const wav = Buffer.alloc(44 + 1280)
wav.write('RIFF')
wav.writeUInt32LE(wav.length - 8, 4)
wav.write('WAVEfmt ', 8)
wav.writeUInt32LE(16, 16)
wav.writeUInt16LE(1, 20)
wav.writeUInt16LE(1, 22)
wav.writeUInt32LE(8000, 24)
wav.writeUInt32LE(16000, 28)
wav.writeUInt16LE(2, 32)
wav.writeUInt16LE(16, 34)
wav.write('data', 36)
wav.writeUInt32LE(1280, 40)
async function record(page, value) {
  return page.evaluate(
    async ({ value, write }) => {
      const db = await new Promise(res => {
        const r = indexedDB.open('keyval-store')
        r.onsuccess = () => res(r.result)
      })
      if (write)
        return new Promise(res => {
          const t = db.transaction('keyval', 'readwrite')
          t.objectStore('keyval').put(JSON.stringify(value), 'typing-word-dict')
          t.oncomplete = res
        })
      return new Promise(res => {
        const r = db.transaction('keyval').objectStore('keyval').get('typing-word-dict')
        r.onsuccess = () => res(JSON.parse(r.result))
      })
    },
    { value, write: arguments.length === 2 }
  )
}
async function nativeType(page, text) {
  for (const c of text) {
    await page.evaluate(c => {
      const input = document.querySelector('#typing-listener')
      input.value = ' ' + c
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: c }))
    }, c)
    await page.waitForTimeout(40)
  }
}
;(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_BIN || '/usr/bin/chromium',
    args: ['--no-sandbox', '--autoplay-policy=user-gesture-required'],
  })
  try {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    })
    await ctx.route('https://dict.youdao.com/**', route =>
      route.fulfill({ status: 200, contentType: 'audio/wav', body: wav })
    )
    await ctx.addInitScript(() => {
      window.mediaResults = []
      window.speechRequests = []
      window.haptics = []
      navigator.vibrate = n => {
        window.haptics.push(n)
        return true
      }
      const original = HTMLMediaElement.prototype.play
      HTMLMediaElement.prototype.play = function () {
        const source = this.src
        const result = original.call(this)
        if (this.id === 'ielts-word-audio')
          result
            ?.then(() => window.mediaResults.push({ source, ok: true, volume: this.volume }))
            .catch(error => window.mediaResults.push({ source, ok: false, error: error.name }))
        return result
      }
      speechSynthesis.speak = message => {
        window.speechRequests.push({ text: message.text, lang: message.lang, volume: message.volume })
        queueMicrotask(() => {
          message.onstart?.()
          message.onend?.()
        })
      }
    })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto(base, { waitUntil: 'networkidle' })
    await page.locator('.hero-ring-button:enabled').waitFor()
    let saved = await record(page)
    saved.val.word.bookList.find(d => d.id === 'ielts-environment').perDayStudyNumber = 15
    saved.val.noteData.preferenceSentinel = '已有笔记'
    saved.val.fsrsData.preferenceSentinel = { due: '2030-01-01', stability: 7, difficulty: 4, reps: 3 }
    await record(page, saved)
    await page.reload({ waitUntil: 'networkidle' })
    await page.locator('.hero-ring-button:enabled').waitFor()
    const avatar = page.locator('.avatar-button[aria-label="偏好设置"]')
    const topicTrigger = page.getByRole('button', { name: '选择主题', exact: true })
    assert.equal(await avatar.count(), 1)
    assert.equal(await page.locator('.header-actions button[aria-label="偏好设置"]').count(), 0)
    assert.ok((await avatar.boundingBox()).x < 40)
    assert.ok((await topicTrigger.boundingBox()).x > 320)
    await page.screenshot({ path: `${output}/header-390.png`, fullPage: true })
    await topicTrigger.click()
    const topics = page.getByRole('menu', { name: '主题', exact: true })
    await topics.waitFor()
    await page.waitForTimeout(850)
    assert.equal(await topics.getByRole('menuitemradio').count(), 6)
    await page.screenshot({ path: `${output}/topics-390.png`, fullPage: true })
    await page.mouse.click(16, 460)
    await topics.waitFor({ state: 'hidden' })
    await avatar.click()
    const sheet = page.getByRole('dialog', { name: '偏好', exact: true })
    await sheet.waitFor()
    await page.waitForTimeout(420)
    assert.equal(await sheet.locator('.sheet-head').count(), 0)
    assert.equal(await sheet.getByRole('slider').count(), 1)
    assert.equal(await sheet.getByRole('switch').count(), 1)
    assert.equal(
      await sheet.getByRole('slider').getAttribute('aria-valuetext'),
      '15 个',
      'legacy goal remains unchanged'
    )
    assert.ok(!/偏好|英式|导出备份|学习记录|主屏幕|关于/.test(await sheet.innerText()))
    await page.screenshot({ path: `${output}/preferences-390.png`, fullPage: true })
    await page.mouse.click(16, 140)
    await sheet.waitFor({ state: 'hidden' })
    await headerAction(page, '偏好设置')
    await page.waitForTimeout(420)
    const handle = await sheet.locator('.sheet-grab').boundingBox()
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
    await page.mouse.down()
    await page.mouse.move(handle.x + handle.width / 2, handle.y + 105, { steps: 8 })
    await page.mouse.up()
    await sheet.waitFor({ state: 'hidden' })
    await headerAction(page, '偏好设置')
    await page.waitForTimeout(420)
    const slider = sheet.getByRole('slider', { name: '每日新词' })
    await slider.focus()
    await page.keyboard.press('End')
    assert.equal(await slider.getAttribute('aria-valuetext'), '40 个')
    await page.keyboard.press('Escape')
    await sheet.waitFor({ state: 'hidden' })
    await page.waitForTimeout(1100)
    await page.reload({ waitUntil: 'networkidle' })
    await page.locator('.hero-ring-button:enabled').waitFor()
    saved = await record(page)
    assert.equal(saved.val.word.bookList.find(d => d.id === 'ielts-environment').perDayStudyNumber, 40)
    assert.equal(saved.val.word.bookList.find(d => d.id === 'ielts-environment').lastLearnIndex, 0)
    assert.equal(saved.val.noteData.preferenceSentinel, '已有笔记')
    assert.equal(saved.val.fsrsData.preferenceSentinel.reps, 3)
    await page.getByRole('button', { name: '开始学习', exact: true }).click()
    await page.waitForURL('**/practice-words/**')
    await page.locator('#word-wrap').waitFor()
    await page.waitForTimeout(500)
    const primary = () => page.evaluate(() => window.mediaResults.filter(r => r.source.startsWith('https:') && r.ok))
    assert.ok((await primary()).length > 0, 'automatic first word uses unlocked native media')
    assert.ok(
      (await primary()).every(r => r.source.startsWith('https://dict.youdao.com/') && r.source.endsWith('type=1'))
    )
    assert.equal(await page.locator('#ielts-word-audio').count(), 1)
    const word = (await page.locator('#word-wrap').innerText()).replace(/\s/g, '')
    let count = (await primary()).length
    await page.locator('#word-wrap').click()
    await page.waitForTimeout(200)
    assert.ok((await primary()).length > count, 'word tap plays audio')
    const box = await page.locator('#word-wrap').boundingBox()
    count = (await primary()).length
    await page.mouse.move(box.x + box.width / 2, box.y + 10)
    await page.mouse.down()
    await page.waitForTimeout(480)
    assert.equal((await primary()).length, count, 'long-press timer itself does not attempt playback')
    await page.mouse.up()
    await page.waitForTimeout(200)
    assert.ok((await primary()).length > count, 'long press plays from the release gesture')
    await headerAction(page, '偏好设置')
    await sheet.getByRole('switch', { name: '自动发音' }).click()
    assert.equal(await sheet.getByRole('switch').getAttribute('aria-checked'), 'false')
    await page.keyboard.press('Escape')
    await sheet.waitFor({ state: 'hidden' })
    count = (await primary()).length
    await nativeType(page, word)
    await page.waitForTimeout(700)
    assert.equal((await primary()).length, count, 'automatic sound off stays silent on the next word')
    await page.locator('#word-wrap').click()
    await page.waitForTimeout(200)
    assert.ok((await primary()).length > count, 'manual word taps still work when automatic sound is off')
    await headerAction(page, '偏好设置')
    count = (await primary()).length
    await sheet.getByRole('switch', { name: '自动发音' }).click()
    await page.waitForTimeout(200)
    assert.ok((await primary()).length > count, 'enabling automatic sound immediately plays the current word')
    await page.keyboard.press('Escape')
    await sheet.waitFor({ state: 'hidden' })
    count = (await primary()).length
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true })
      document.dispatchEvent(new Event('visibilitychange'))
      Object.defineProperty(document, 'hidden', { configurable: true, value: false })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await page.waitForTimeout(150)
    assert.equal((await primary()).length, count, 'foreground playback waits for the next gesture')
    await headerAction(page, '打开键盘')
    await page.waitForTimeout(250)
    assert.ok((await primary()).length > count, 'first foreground tap unlocks the queued current word')
    assert.equal(await page.locator('#ielts-word-audio').count(), 1)
    assert.ok((await page.evaluate(() => window.haptics)).every(n => n === 8))
    await page.getByRole('link', { name: '保存并返回' }).click()
    await page.locator('.hero-ring-button:enabled').waitFor()
    await topicTrigger.click()
    await topics.waitFor()
    await page.waitForTimeout(850)
    await page.screenshot({ path: `${output}/topics-after-lesson-390.png`, fullPage: true })
    await topics.getByRole('menuitemradio', { name: '教育', exact: true }).click()
    await topics.waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: '开始学习', exact: true }).waitFor()
    assert.match(await page.locator('.hero-ring-button').innerText(), /教育/)
    await avatar.click()
    await sheet.waitFor()
    assert.equal(await sheet.getByRole('slider').count(), 1)
    assert.equal(await sheet.getByRole('switch').count(), 1)
    assert.deepEqual(errors, [])
    console.log(
      'PASS: two-item 390px preferences, preserved legacy/40 goal, existing records, native media playback, tap/release gestures, auto toggle, foreground unlock, one reusable element'
    )
    await ctx.close()
  } finally {
    await browser.close()
  }
})().catch(error => {
  console.error(error)
  process.exitCode = 1
})

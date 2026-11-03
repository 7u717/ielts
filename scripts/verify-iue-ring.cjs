const { chromium } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const output = process.env.IELTS_SCREENSHOTS || '/workspace/artifacts/iue-ring-polish'
fs.mkdirSync(output, { recursive: true })
;(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] })
  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    })
    await context.addInitScript(() => {
      window.haptics = []
      navigator.vibrate = ms => {
        window.haptics.push(ms)
        return true
      }
      speechSynthesis.speak = u => setTimeout(() => u.onend?.(), 0)
      HTMLMediaElement.prototype.play = () => Promise.resolve()
    })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto('http://127.0.0.1:4173/ielts/', { waitUntil: 'networkidle' })
    await page.locator('.hero-ring-button:enabled').waitFor()
    await page.waitForTimeout(1700)
    assert.equal(await page.locator('.hero-ring-button svg').getAttribute('viewBox'), '0 0 220 220')
    assert.equal(await page.locator('.hero-ring-button .ring-track').getAttribute('r'), '96')
    assert.equal(await page.locator('.hero-ring-button .iue-ring').evaluate(e => e.getBoundingClientRect().width), 220)
    assert.equal(await page.locator('.ring-dot').count(), 0)
    assert.equal(await page.locator('.hero-count').count(), 0)
    assert.equal(await page.locator('.hero-topic').innerText(), '环境')
    assert.equal(await page.locator('.hero-meta').innerText(), '今日 0/20 · 已学 0/24')
    assert.equal(
      await page.locator('.hero-ring-button .ring-track').evaluate(e => getComputedStyle(e).strokeWidth),
      '1px'
    )
    assert.equal(
      await page.locator('.hero-ring-button .ring-arc').evaluate(e => getComputedStyle(e).transitionDuration),
      '1.6s'
    )
    assert.equal(await page.locator('.word-row > .iue-icon').count(), 0)
    assert.notEqual(
      await page.locator('.tab-indicator').evaluate(e => getComputedStyle(e).backgroundColor),
      'rgb(245, 245, 247)'
    )
    await page.screenshot({ path: output + '/home-390.png', fullPage: true })
    await page.getByRole('button', { name: '偏好设置', exact: true }).click()
    const sheet = page.getByRole('dialog', { name: '偏好', exact: true })
    await page.waitForTimeout(450)
    assert.equal(await sheet.getByRole('slider').evaluate(e => getComputedStyle(e).opacity), '1')
    assert.equal(await sheet.locator('.quiet-switch span').evaluate(e => e.getBoundingClientRect().width), 44)
    assert.equal(await sheet.locator('.quiet-switch span').evaluate(e => e.getBoundingClientRect().height), 26)
    assert.equal(await sheet.locator('.goal-value').evaluate(e => getComputedStyle(e).fontSize), '48px')
    assert.match(await sheet.evaluate(e => getComputedStyle(e).backdropFilter), /blur\(30px\)/)
    await page.screenshot({ path: output + '/preferences-390.png', fullPage: true })
    await page.keyboard.press('Escape')
    await sheet.waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: '选择主题', exact: true }).click()
    await page.waitForTimeout(850)
    assert.equal(await page.getByRole('menuitemradio').count(), 6)
    await page.screenshot({ path: output + '/theme-menu-390.png', fullPage: true })
    await page.getByRole('button', { name: '选择主题', exact: true }).click()
    await page.getByRole('menu', { name: '主题', exact: true }).waitFor({ state: 'hidden' })
    // Give the ring real saved progress without changing any user's browser storage.
    await page.evaluate(async () => {
      const db = await new Promise(resolve => {
        const r = indexedDB.open('keyval-store')
        r.onsuccess = () => resolve(r.result)
      })
      const value = await new Promise(resolve => {
        const r = db.transaction('keyval').objectStore('keyval').get('typing-word-dict')
        r.onsuccess = () => resolve(JSON.parse(r.result))
      })
      const dict = value.val.word.bookList.find(d => d.id === 'ielts-environment')
      dict.statistics.push({ startDate: Date.now(), new: 5 })
      await new Promise(resolve => {
        const t = db.transaction('keyval', 'readwrite')
        t.objectStore('keyval').put(JSON.stringify(value), 'typing-word-dict')
        t.oncomplete = resolve
      })
      db.close()
    })
    await page.reload({ waitUntil: 'networkidle' })
    await page.locator('.hero-ring-button:enabled').waitFor()
    await page.waitForTimeout(1800)
    assert.equal(await page.locator('.hero-meta').innerText(), '今日 5/20 · 已学 0/24')
    const arc = await page.locator('.hero-ring-button .ring-arc').evaluate(e => ({
      offset: parseFloat(getComputedStyle(e).strokeDashoffset),
      full: parseFloat(e.getAttribute('stroke-dasharray')),
    }))
    assert.ok(Math.abs(arc.offset / arc.full - 0.75) < 0.01)
    await page.screenshot({ path: output + '/home-progress-390.png', fullPage: true })
    await page.locator('.hero-ring-button').click()
    await page.waitForTimeout(110)
    assert.equal(await page.locator('.ring-zooming').count(), 1)
    await page.waitForURL('**/practice-words/**')
    await page.locator('#word-wrap').waitFor()
    await page.waitForTimeout(600)
    assert.match(await page.locator('.study-count').innerText(), /^1\/\d+$/)
    assert.equal(
      await page.locator('.typing-core .letter').evaluate(e => getComputedStyle(e).color),
      'rgb(245, 245, 247)'
    )
    await page.screenshot({ path: output + '/study-390.png', fullPage: true })
    await page.locator('#word-wrap').click()
    await page.waitForTimeout(450)
    const box = await page.locator('#word-wrap').boundingBox()
    await page.mouse.move(box.x + box.width / 2, box.y + 30)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 + 40, box.y + 34, { steps: 6 })
    const tilted = await page.locator('.word-stage').evaluate(e => getComputedStyle(e).transform)
    assert.notEqual(tilted, 'none')
    await page.screenshot({ path: output + '/study-drag-390.png', fullPage: true })
    await page.mouse.up()
    await page.waitForTimeout(600)
    const before = await page.locator('#word-wrap').innerText()
    await page.mouse.move(box.x + box.width / 2, box.y + 30)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 - 100, box.y + 34, { steps: 8 })
    await page.mouse.up()
    await page.waitForTimeout(1000)
    assert.notEqual(await page.locator('#word-wrap').innerText(), before)
    assert.ok((await page.evaluate(() => window.haptics)).includes(8))
    await page.getByRole('link', { name: '保存并返回' }).click()
    await page.locator('.hero-ring-button:enabled').waitFor()
    await page.locator('.hero-ring-button').click()
    await page.waitForURL('**/practice-words/**')
    await page.locator('#word-wrap').waitFor()
    assert.equal(await page.locator('.gesture-hint').count(), 0, 'hint stays dismissed on later visits')
    assert.deepEqual(errors, [])
    await context.close()
    const reduced = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' })
    const quiet = await reduced.newPage()
    await quiet.goto('http://127.0.0.1:4173/ielts/', { waitUntil: 'networkidle' })
    await quiet.locator('.hero-ring-button:enabled').waitFor()
    assert.equal(await quiet.locator('.hero-meta').innerText(), '今日 0/20 · 已学 0/24')
    assert.equal(
      await quiet.locator('.hero-ring-button .ring-arc').evaluate(e => getComputedStyle(e).transitionDuration),
      '0s'
    )
    await reduced.close()
    console.log(
      'PASS: 390px iue geometry/drawing/original ring content, real daily progress, native knob/switch, unchanged menu, ring zoom, white word/count, drag tilt/return/fly, haptics, reduced motion'
    )
  } finally {
    await browser.close()
  }
})().catch(e => {
  console.error(e)
  process.exit(1)
})

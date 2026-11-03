const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict'),
  fs = require('node:fs')
const base = process.env.IELTS_TEST_URL || 'http://127.0.0.1:4173/ielts/'
const out = process.env.IELTS_SCREENSHOTS || '/tmp/ielts-home-focus'
fs.mkdirSync(out, { recursive: true })
async function stored(page, patch) {
  return page.evaluate(async patch => {
    const db = await new Promise(resolve => {
      const r = indexedDB.open('keyval-store')
      r.onsuccess = () => resolve(r.result)
    })
    const raw = await new Promise(resolve => {
      const r = db.transaction('keyval').objectStore('keyval').get('typing-word-dict')
      r.onsuccess = () => resolve(JSON.parse(r.result))
    })
    if (patch) {
      const dict = raw.val.word.bookList.find(d => d.id === 'ielts-environment')
      dict.perDayStudyNumber = patch.goal
      dict.lastLearnIndex = patch.index
      dict.statistics = [{ startDate: Date.now(), spend: 1, total: patch.done, new: patch.done, review: 0, wrong: 0 }]
      raw.val.noteData.biodiversity = 'preserve home redesign note'
      await new Promise(resolve => {
        const tx = db.transaction('keyval', 'readwrite')
        tx.objectStore('keyval').put(JSON.stringify(raw), 'typing-word-dict')
        tx.oncomplete = resolve
      })
    }
    db.close()
    return raw.val
  }, patch)
}
;(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] })
  try {
    for (const scheme of ['dark', 'light']) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        colorScheme: scheme,
      })
      await context.route('https://dict.youdao.com/**', r => r.abort())
      await context.addInitScript(() => {
        HTMLMediaElement.prototype.play = function () {
          return this.src.startsWith('https:') ? Promise.reject(new Error('fixture')) : Promise.resolve()
        }
        speechSynthesis.speak = u => queueMicrotask(() => u.onend?.())
        navigator.vibrate = () => true
      })
      const page = await context.newPage(),
        errors = []
      page.on('pageerror', e => errors.push(e.message))
      const shot = name => page.screenshot({ path: `${out}/${name}-${scheme}-390.png`, fullPage: true })
      const ready = () => page.locator('.hero-ring-button:enabled').waitFor()
      const reload = async () => {
        await page.reload({ waitUntil: 'networkidle' })
        await ready()
        await page.waitForTimeout(950)
      }
      await page.goto(base, { waitUntil: 'networkidle' })
      await ready()
      await page.waitForTimeout(500)
      assert.equal(await page.locator('.home-remaining').innerText(), '20')
      assert.equal(await page.locator('.home-start-label').innerText(), '开始')
      assert.equal(await page.locator('.hero-ring-button .ring-track').count(), 1)
      assert.equal(
        await page.locator('.hero-ring-button .ring-today-track, .hero-ring-button .ring-review-track').count(),
        0
      )
      assert.equal(await page.getByRole('dialog', { name: '学习概览', exact: true }).count(), 0)
      assert.equal(await page.locator('.home-header .header-title').innerText(), '雅思')
      for (const nav of await page.locator('.unified-dock button').all()) {
        const box = await nav.boundingBox()
        assert.ok(box.width >= 44 && box.height >= 44)
      }
      assert.equal(await page.locator('.tab-indicator').evaluate(e => getComputedStyle(e).width), '44px')
      assert.equal(await page.locator('.home-remaining').evaluate(e => getComputedStyle(e).fontWeight), '300')
      await shot('home-zero')
      await page.getByRole('button', { name: '偏好设置', exact: true }).click()
      const preferences = page.getByRole('dialog', { name: '偏好', exact: true })
      await preferences.waitFor()
      assert.equal(await preferences.getByRole('slider').count(), 1)
      assert.equal(await preferences.getByRole('switch').count(), 1)
      await page.waitForTimeout(400)
      await shot('preferences')
      await page.mouse.click(8, 100)
      await preferences.waitFor({ state: 'hidden' })
      await page.getByRole('button', { name: '选择主题', exact: true }).click()
      const topics = page.getByRole('menu', { name: '主题', exact: true })
      await topics.waitFor()
      await page.waitForTimeout(800)
      assert.equal(await topics.getByRole('menuitemradio').count(), 6)
      const orbs = await topics.getByRole('menuitemradio').all()
      for (let i = 0; i < 6; i++) {
        assert.ok(Math.abs((await orbs[i].boundingBox()).width - 38) < 0.1)
        assert.ok(
          Math.abs(parseFloat(await orbs[i].evaluate(e => getComputedStyle(e).transitionDelay)) - i * 0.03) < 0.001
        )
      }
      await shot('topics')
      await page.mouse.click(8, 400)
      await topics.waitFor({ state: 'hidden' })
      await page.waitForTimeout(400)
      await stored(page, { goal: 20, index: 6, done: 6 })
      await reload()
      assert.equal(await page.locator('.home-remaining').innerText(), '14')
      const arc = page.locator('.hero-ring-button .ring-arc')
      assert.ok(Math.abs(Number(await arc.getAttribute('stroke-dashoffset')) / (2 * Math.PI * 110) - 0.7) < 0.001)
      const weight = await arc.evaluate(
        e => (parseFloat(getComputedStyle(e).strokeWidth) * e.ownerSVGElement.getBoundingClientRect().width) / 240
      )
      assert.ok(Math.abs(weight - 5) < 0.01)
      const radii = await page
        .locator('.hero-ring-button circle')
        .evaluateAll(es => es.map(e => Number(e.getAttribute('r'))))
      assert.ok(radii.every(r => r === 110))
      await shot('home-progress')
      let raw = await stored(page)
      assert.equal(raw.noteData.biodiversity, 'preserve home redesign note')
      assert.equal(raw.word.bookList.find(d => d.id === 'ielts-environment').lastLearnIndex, 6)
      await stored(page, { goal: 15, index: 6, done: 6 })
      await reload()
      assert.equal(await page.locator('.home-remaining').innerText(), '9', 'custom saved daily targets remain intact')
      await stored(page, { goal: 40, index: 0, done: 0 })
      await reload()
      assert.equal(
        await page.locator('.home-remaining').innerText(),
        '24',
        'remaining count is capped by actual available words'
      )
      raw = await stored(page)
      assert.equal(raw.word.bookList.find(d => d.id === 'ielts-environment').perDayStudyNumber, 40)
      await stored(page, { goal: 20, index: 6, done: 6 })
      await reload()
      await page.locator('.hero-ring-button').click()
      await page.waitForURL('**/practice-words/**')
      await page.locator('#word-wrap').waitFor()
      await page.waitForTimeout(450)
      assert.equal(await page.locator('.home-header').count(), 0)
      assert.equal(
        await page
          .locator('.word-tools .icon-button')
          .first()
          .evaluate(e => getComputedStyle(e).width),
        '44px'
      )
      assert.equal(await page.locator('.word-translation').evaluate(e => getComputedStyle(e).opacity), '0.76')
      const word = await page.locator('#word-wrap').innerText()
      await shot('study-unchanged')
      await page.getByRole('link', { name: '保存并返回' }).click()
      await ready()
      assert.equal(await page.locator('.hero-ring-button').getAttribute('aria-label'), '继续学习')
      await page.locator('.hero-ring-button').click()
      await page.waitForURL('**/practice-words/**')
      await page.locator('#word-wrap').waitFor()
      assert.equal(await page.locator('#word-wrap').innerText(), word, 'one-tap ring resumes the saved session')
      await page.getByRole('link', { name: '保存并返回' }).click()
      await ready()
      await page.setViewportSize({ width: 390, height: 667 })
      await page.waitForTimeout(450)
      assert.ok(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= 390 && document.documentElement.scrollHeight <= 669
        )
      )
      await shot('home-compact')
      assert.deepEqual(errors, [])
      console.log(
        `PASS ${scheme}: 390px single daily ring; real remaining counts and legacy targets; bold 44px nav; preserved topic menu/preferences; direct start/resume; study styling unchanged; compact layout fits`
      )
      await context.close()
    }
  } finally {
    await browser.close()
  }
})().catch(e => {
  console.error(e)
  process.exitCode = 1
})

const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const { startStudy, closeWordDetails, chooseStudyMode } = require('./mobile-actions.cjs')
const assert = require('node:assert/strict'),
  fs = require('node:fs')
const base = process.env.IELTS_TEST_URL || 'http://127.0.0.1:4173/ielts/',
  out = process.env.IELTS_SCREENSHOTS || '/tmp/ielts-card'
fs.mkdirSync(out, { recursive: true })
const word = p => p.locator('#word-wrap').innerText()
async function saved(p) {
  return p.evaluate(async () => {
    const db = await new Promise(resolve => {
      const r = indexedDB.open('keyval-store')
      r.onsuccess = () => resolve(r.result)
    })
    return new Promise(resolve => {
      const r = db.transaction('keyval').objectStore('keyval').get('typing-word-dict')
      r.onsuccess = () => resolve(JSON.parse(r.result).val)
    })
  })
}
async function changed(p, old) {
  await p.waitForFunction(v => {
    const e = document.querySelector('#word-wrap')
    return e && e.innerText !== v
  }, old)
  await p.waitForTimeout(420)
}
async function drag(p, dx, release = true) {
  const b = await p.locator('#word-wrap').boundingBox()
  await p.mouse.move(b.x + b.width / 2, b.y + 25)
  await p.mouse.down()
  await p.mouse.move(b.x + b.width / 2 + dx, b.y + 25, { steps: 8 })
  if (release) await p.mouse.up()
}
;(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] })
  try {
    for (const scheme of ['dark', 'light']) {
      const c = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        colorScheme: scheme,
      })
      await c.route('https://dict.youdao.com/**', r => r.abort())
      await c.addInitScript(() => {
        window.haptics = []
        HTMLMediaElement.prototype.play = function () {
          return this.src.startsWith('https:') ? Promise.reject(new Error('fixture')) : Promise.resolve()
        }
        speechSynthesis.speak = u => queueMicrotask(() => u.onend?.())
        navigator.vibrate = n => {
          window.haptics.push(n)
          return true
        }
      })
      const p = await c.newPage(),
        errors = []
      p.on('pageerror', e => errors.push(e.message))
      await p.goto(base, { waitUntil: 'networkidle' })
      await p.locator('.hero-ring-button:enabled').waitFor()
      assert.equal(await p.locator('.unified-dock button').count(), 4)
      assert.equal(await p.locator('.hero-ring-button .ring-track').count(), 1)
      await p.screenshot({ path: `${out}/home-${scheme}-390.png`, fullPage: true })
      await p.locator('.hero-ring-button').click()
      const disc = p.getByRole('dialog', { name: '学习概览', exact: true })
      await disc.waitFor()
      await p.waitForTimeout(450)
      assert.equal(await disc.locator('.ring-track').count(), 1)
      assert.equal(await disc.locator('.ring-review-track').count(), 0)
      await p.screenshot({ path: `${out}/disc-${scheme}-390.png`, fullPage: true })
      await p.mouse.click(8, 100)
      await disc.waitFor({ state: 'hidden' })
      await chooseStudyMode(p, '打字')
      await chooseStudyMode(p, '听写')
      await chooseStudyMode(p, '学习')
      await p.getByRole('button', { name: '偏好设置', exact: true }).click()
      const avatar = p.getByRole('dialog', { name: '偏好', exact: true })
      await avatar.waitFor()
      await p.waitForTimeout(400)
      assert.equal(await avatar.getByRole('slider').count(), 1)
      assert.equal(await avatar.getByRole('switch').count(), 1)
      assert.equal(await avatar.getByRole('button').count(), 0)
      assert.equal(await avatar.locator('.avatar-mode-picker').count(), 0)
      assert.equal(await avatar.locator('.goal-rail').evaluate(e => getComputedStyle(e).height), '6px')
      assert.equal(await avatar.locator('.goal-cursor').evaluate(e => getComputedStyle(e).width), '20px')
      const slider = avatar.getByRole('slider')
      const bounds = await slider.boundingBox()
      const countBefore = await p.evaluate(() => window.haptics.length)
      await p.mouse.move(bounds.x + 10, bounds.y + bounds.height / 2)
      await p.mouse.down()
      for (let n = 1; n <= 3; n++) {
        await p.mouse.move(bounds.x + 10 + ((bounds.width - 20) * n) / 3, bounds.y + bounds.height / 2, { steps: 5 })
        await p.waitForTimeout(90)
      }
      await p.screenshot({ path: `${out}/preferences-drag-${scheme}-390.png`, fullPage: true })
      await p.mouse.up()
      assert.ok(
        await p.evaluate(n => window.haptics.length >= n + 3, countBefore),
        'each slider detent has a light haptic'
      )
      await slider.press('Home')
      await slider.press('ArrowRight')
      await p.screenshot({ path: `${out}/preferences-${scheme}-390.png`, fullPage: true })
      await p.mouse.click(8, 100)
      await avatar.waitFor({ state: 'hidden' })
      await startStudy(p)
      await p.locator('#word-wrap').waitFor()
      await p.waitForTimeout(450)
      assert.equal(
        await p.locator('.practice-mini-progress').evaluate(e => getComputedStyle(e).backgroundColor),
        'rgba(0, 0, 0, 0)'
      )
      assert.equal(await p.locator('.card-actions button').count(), 2)
      for (const b of await p.locator('.word-tools button').all()) {
        const box = await b.boundingBox()
        assert.ok(box.width >= 44 && box.height >= 44)
      }
      await p.locator('#word-wrap').click()
      await p.locator('.word-detail-sheet').waitFor()
      await p.waitForTimeout(350)
      assert.ok(await p.locator('.detail-phonetic').innerText())
      assert.equal(await p.locator('.card-actions').evaluate(e => getComputedStyle(e).visibility), 'hidden')
      assert.equal(
        await p.locator('.word-detail-sheet').evaluate(e => getComputedStyle(e).backdropFilter),
        'blur(40px) saturate(1.8)'
      )
      assert.equal(
        await p.locator('.word-detail-sheet').evaluate(e => getComputedStyle(e, '::backdrop').backdropFilter),
        'blur(4px)'
      )
      for (const example of await p.locator('.word-detail-sheet .word-examples p').all()) {
        assert.equal(await example.evaluate(e => getComputedStyle(e).textAlign), 'center')
      }
      await p.screenshot({ path: `${out}/mouse-details-${scheme}-390.png`, fullPage: true })
      await closeWordDetails(p)
      await p.locator('#word-wrap').tap()
      await p.locator('.word-detail-sheet').waitFor()
      await closeWordDetails(p)
      await p.getByRole('button', { name: '查看释义详情', exact: true }).click()
      await p.locator('.word-detail-sheet').waitFor()
      await closeWordDetails(p)
      assert.equal(await p.locator('.card-actions').evaluate(e => getComputedStyle(e).visibility), 'visible')
      for (const el of await p.locator('.word-stage, .word-stage *').all()) {
        assert.equal(await el.evaluate(e => getComputedStyle(e).userSelect), 'none')
        if (await p.evaluate(() => CSS.supports('-webkit-touch-callout', 'none'))) {
          assert.equal(await el.evaluate(e => getComputedStyle(e).getPropertyValue('-webkit-touch-callout')), 'none')
        }
      }
      assert.match(await p.locator('.typing-word').evaluate(e => getComputedStyle(e).maskImage), /linear-gradient/)
      assert.equal(await p.locator('.next-card-echo').count(), 0, 'no blurred ghost during a swipe')
      for (const el of await p.locator('.typing-core, .sentence-preview').all()) {
        assert.match(await el.evaluate(e => getComputedStyle(e).fontFamily), /^-apple-system/)
      }
      await p.screenshot({ path: `${out}/learning-rest-${scheme}-390.png`, fullPage: true })
      const wordBefore = await p.locator('#word-wrap').boundingBox()
      const first = await word(p)
      await drag(p, 38, false)
      const turn = await p
        .locator('.word-swipe-surface')
        .evaluate(e => getComputedStyle(e).getPropertyValue('--word-turn'))
      assert.ok(parseFloat(turn) > 0)
      const wordDuring = await p.locator('#word-wrap').boundingBox()
      assert.ok(wordDuring.x > wordBefore.x + 20, 'word travels with current card')
      assert.equal(await p.locator('#word-wrap').count(), 1)
      await p.mouse.up()
      await p.waitForTimeout(400)
      assert.equal(await word(p), first)
      assert.equal(
        await p.locator('.word-swipe-surface').evaluate(e => getComputedStyle(e).transform),
        'matrix(1, 0, 0, 1, 0, 0)'
      )
      const count = await p.evaluate(() => window.haptics.length)
      await drag(p, 130, false)
      assert.ok(await p.evaluate(n => window.haptics.length > n, count))
      assert.equal(
        await p.evaluate(() => window.getSelection().toString()),
        '',
        'drag must not select word or example text'
      )
      for (const el of await p.locator('.word-stage, .word-swipe-surface, #word-wrap').all()) {
        assert.equal(await el.evaluate(e => getComputedStyle(e).overflow), 'visible')
      }
      await p.screenshot({ path: `${out}/drag-${scheme}-390.png`, fullPage: true })
      await p.mouse.up()
      await changed(p, first)
      const second = await word(p)
      await drag(p, -130)
      await changed(p, second)
      await p.waitForTimeout(900)
      const d = await saved(p),
        wrong = d.word.bookList.find(x => x.id === 'wordWrong')
      assert.ok(
        wrong.words.some(x => x.word === second.replace(/\s/g, '')),
        'left swipe records review instead of excluding the word'
      )
      const third = await word(p)
      await p.getByRole('button', { name: '认识', exact: true }).click()
      await changed(p, third)
      const fourth = await word(p)
      await p.getByRole('button', { name: '再看', exact: true }).click()
      await changed(p, fourth)
      await p.screenshot({ path: `${out}/learning-${scheme}-390.png`, fullPage: true })
      await p.getByRole('link', { name: '保存并返回' }).click()
      await p.locator('.hero-ring-button:enabled').waitFor()
      await p.evaluate(async () => {
        const db = await new Promise(resolve => {
          const r = indexedDB.open('keyval-store')
          r.onsuccess = () => resolve(r.result)
        })
        const raw = await new Promise(resolve => {
          const r = db.transaction('keyval').objectStore('keyval').get('typing-word-dict')
          r.onsuccess = () => resolve(JSON.parse(r.result))
        })
        raw.val.simpleWords.push('biodiversity')
        await new Promise(resolve => {
          const tx = db.transaction('keyval', 'readwrite')
          tx.objectStore('keyval').put(JSON.stringify(raw), 'typing-word-dict')
          tx.oncomplete = resolve
        })
      })
      await p.reload({ waitUntil: 'networkidle' })
      await p.locator('.hero-ring-button:enabled').waitFor()
      await p.getByRole('button', { name: '环境词表', exact: true }).click()
      const v = p.getByRole('dialog', { name: '环境', exact: true })
      await v.waitFor()
      await p.waitForTimeout(500)
      assert.equal(
        await v
          .locator('.vocabulary-entry')
          .nth(1)
          .evaluate(e => getComputedStyle(e).animationDelay),
        '0.02s'
      )
      assert.equal(
        await v
          .locator('.vocabulary-entry')
          .nth(2)
          .evaluate(e => getComputedStyle(e).animationDelay),
        '0.04s'
      )
      assert.equal(
        await v.getByRole('button', { name: 'biodiversity', exact: true }).locator('.mastered-dot').count(),
        1
      )
      assert.equal(
        await v.getByRole('button', { name: 'sustainability', exact: true }).locator('.mastered-dot').count(),
        0
      )
      const row = v.getByRole('button', { name: 'biodiversity', exact: true })
      const rowBox = await row.boundingBox()
      const hapticsBefore = await p.evaluate(() => window.haptics.length)
      await p.mouse.move(rowBox.x + 30, rowBox.y + rowBox.height / 2)
      await p.mouse.down()
      await p.waitForTimeout(180)
      assert.equal(await row.evaluate(e => e.classList.contains('is-pressed')), true)
      const rowScale = await row.evaluate(e => getComputedStyle(e).transform)
      assert.ok(rowScale.startsWith('matrix(0.98'))
      assert.equal(await p.evaluate(() => window.haptics.length), hapticsBefore + 1)
      await p.screenshot({ path: `${out}/vocabulary-press-${scheme}-390.png`, fullPage: true })
      await p.mouse.up()
      await p.locator('.vocabulary-detail').waitFor()
      await p.mouse.click(8, 100)
      await p.locator('.vocabulary-detail').waitFor({ state: 'hidden' })
      await p.screenshot({ path: `${out}/vocabulary-${scheme}-390.png`, fullPage: true })
      assert.deepEqual(errors, [])
      assert.ok((await p.evaluate(() => window.haptics)).every(n => n === 8))
      console.log(
        `PASS ${scheme}: four core dock entries plus contextual dock modes; mouse/touch/meaning details; transparent progress track; 44px tools; rotation, threshold haptic, spring return, right-known/left-review and equivalent buttons; 20ms list stagger; single disc track; no drag echo; moving current text; press-time row scale/haptic; selection-free drag with edge fade; isolated detail glass and centered examples`
      )
      await c.close()
    }
  } finally {
    await browser.close()
  }
})().catch(e => {
  console.error(e)
  process.exitCode = 1
})

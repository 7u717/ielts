const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const base = process.env.IELTS_TEST_URL || 'http://127.0.0.1:4173/ielts/'
const out = process.env.IELTS_SCREENSHOTS || '/tmp/ielts-zero-touch'
fs.mkdirSync(out, { recursive: true })
async function drag(page, locator, dx, dy) {
  const b = await locator.boundingBox(),
    x = b.x + b.width / 2,
    y = b.y + b.height / 2
  const c = await page.context().newCDPSession(page)
  await c.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  for (let n = 1; n <= 8; n++)
    await c.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x + (dx * n) / 8, y: y + (dy * n) / 8 }],
    })
  await c.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await c.detach()
}
;(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] })
  try {
    for (const scheme of ['dark', 'light']) {
      const ctx = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        colorScheme: scheme,
      })
      await ctx.route('https://dict.youdao.com/**', r => r.abort())
      await ctx.addInitScript(() => {
        window.spoken = []
        window.haptics = []
        HTMLMediaElement.prototype.play = function () {
          return this.src.startsWith('https:') ? Promise.reject(new Error('fixture')) : Promise.resolve()
        }
        speechSynthesis.speak = u => {
          window.spoken.push(u.text)
          queueMicrotask(() => {
            u.onstart?.()
            u.onend?.()
          })
        }
        navigator.vibrate = n => {
          window.haptics.push(n)
          return true
        }
      })
      const p = await ctx.newPage(),
        errors = []
      p.on('pageerror', e => errors.push(e.message))
      const shot = name => p.screenshot({ path: `${out}/${name}-${scheme}-390.png`, fullPage: true })
      await p.goto(base, { waitUntil: 'networkidle' })
      await p.locator('.hero-ring-button:enabled').waitFor()
      await shot('home')
      await p.locator('.hero-ring-button').tap()
      const disc = p.getByRole('dialog', { name: '学习概览', exact: true })
      await disc.waitFor()
      await p.waitForTimeout(450)
      assert.equal(await disc.getByRole('progressbar', { name: '本话题已学进度' }).getAttribute('aria-valuenow'), '0')
      assert.equal(await disc.getByRole('progressbar', { name: '本话题待复习比例' }).getAttribute('aria-valuenow'), '0')
      assert.equal(await disc.locator('.ring-track').count(), 2)
      for (const c of await disc.locator('.ring-track').all()) {
        const s = await c.evaluate(e => ({
          opacity: +getComputedStyle(e).opacity,
          width: +getComputedStyle(e).strokeWidth.replace('px', ''),
        }))
        assert.ok(s.opacity >= 0.22)
        assert.ok((s.width * 278) / 240 > 1.99)
      }
      const name = await disc.locator('h2').boundingBox(),
        play = await disc.locator('.overview-start').boundingBox(),
        box = await disc.boundingBox()
      assert.ok(Math.abs(name.y + name.height / 2 - (box.y + box.height / 2)) < 1)
      assert.ok(play.y - name.y - name.height >= 23 && play.y - name.y - name.height <= 25)
      await shot('overview-zero')
      await p.touchscreen.tap(8, 100)
      await disc.waitFor({ state: 'hidden' })
      await p.getByRole('button', { name: '环境词表', exact: true }).tap()
      const vocab = p.getByRole('dialog', { name: '环境', exact: true })
      await vocab.waitFor()
      await p.waitForTimeout(450)
      assert.ok((await vocab.evaluate(e => getComputedStyle(e).backdropFilter)).includes('blur(30px) saturate(1.8)'))
      assert.ok(+(await p.locator('.hero-ring-button').evaluate(e => getComputedStyle(e).opacity)) > 0.4)
      await shot('vocabulary')
      await drag(p, vocab.locator('.sheet-grab'), 0, 140)
      await vocab.waitFor({ state: 'hidden' })
      await p.waitForTimeout(400)
      await p.getByRole('button', { name: '偏好设置', exact: true }).tap()
      const prefs = p.getByRole('dialog', { name: '偏好', exact: true })
      await prefs.waitFor()
      await p.waitForTimeout(450)
      assert.equal(await prefs.locator('.goal-ticks').count(), 0)
      const thumb = await prefs.locator('.goal-cursor').boundingBox()
      assert.equal(thumb.width, 12)
      assert.equal(thumb.height, 12)
      await shot('preferences')
      await drag(p, prefs.locator('input[type=range]'), 70, 0)
      await p.waitForTimeout(300)
      assert.ok(await prefs.locator('.goal-value').innerText())
      await p.touchscreen.tap(8, 100)
      await prefs.waitFor({ state: 'hidden' })
      await p.waitForTimeout(400)
      await p.locator('.hero-ring-button').tap()
      await disc.waitFor()
      await disc.locator('.overview-start').tap()
      await p.locator('#word-wrap').waitFor()
      await p.waitForTimeout(450)
      assert.equal(await p.locator('.gesture-hint').count(), 0)
      await shot('learning')
      // Suppress the compatibility click entirely: pointer release must still open the real modal.
      await p.evaluate(() =>
        document.addEventListener(
          'click',
          e => {
            if (e.target.closest('#word-wrap')) e.stopImmediatePropagation()
          },
          true
        )
      )
      await p.locator('#word-wrap').tap()
      const detail = p.locator('.word-detail-sheet')
      await detail.waitFor()
      await p.waitForTimeout(450)
      assert.ok((await detail.locator('.detail-phonetic').innerText()).includes('baɪəʊ'))
      assert.ok((await detail.locator('.word-examples').innerText()).includes('biodiversity'))
      assert.equal(await detail.getByRole('button', { name: '关闭', exact: true }).count(), 0)
      await shot('details')
      await p.touchscreen.tap(8, 100)
      await detail.waitFor({ state: 'hidden' })
      await p.getByRole('button', { name: '查看释义详情', exact: true }).tap()
      await detail.waitFor()
      await p.waitForTimeout(400)
      await drag(p, detail.locator('.detail-word-heading h2'), 0, 140)
      await detail.waitFor({ state: 'hidden' })
      assert.deepEqual(errors, [])
      assert.ok((await p.evaluate(() => window.haptics)).every(n => n === 8))
      console.log(
        `PASS ${scheme}: unseeded zero progress shows two 2px inner-edge rings; centered name/play gap24; 30px real glass; round thumb; real touch and absent compatibility click open IPA/example/audio details; outside/drag dismiss; no footer hint`
      )
      await ctx.close()
    }
  } finally {
    await browser.close()
  }
})().catch(e => {
  console.error(e)
  process.exitCode = 1
})

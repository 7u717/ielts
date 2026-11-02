const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const { startStudy } = require('./mobile-actions.cjs')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const base = process.env.IELTS_TEST_URL || 'http://127.0.0.1:4173/ielts/'
const output = process.env.IELTS_SCREENSHOTS || '/tmp/ielts-precision'
fs.mkdirSync(output, { recursive: true })
async function type(page, text) {
  for (const c of text) {
    await page.evaluate(c => {
      const input = document.querySelector('#typing-listener')
      input.value = ' ' + c
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: c }))
    }, c)
    await page.waitForTimeout(30)
  }
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
        localStorage.setItem('ielts-gesture-hint-v1', '1')
        window.spoken = []
        window.haptics = []
        navigator.vibrate = n => {
          window.haptics.push(n)
          return true
        }
        HTMLMediaElement.prototype.play = function () {
          return this.src.startsWith('https:') ? Promise.reject(new Error('fixture')) : Promise.resolve()
        }
        speechSynthesis.speak = u => {
          window.spoken.push({ text: u.text, volume: u.volume })
          queueMicrotask(() => {
            u.onstart?.()
            u.onend?.()
          })
        }
      })
      const page = await ctx.newPage(),
        errors = []
      page.on('pageerror', e => errors.push(e.message))
      await page.goto(base, { waitUntil: 'networkidle' })
      await page.locator('.hero-ring-button:enabled').waitFor()
      const modes = page.getByRole('group', { name: '学习模式' })
      assert.equal(await modes.getByRole('button').count(), 4)
      const box = await modes.boundingBox()
      assert.ok(Math.abs(box.x + box.width / 2 - 195) < 0.5, 'four-segment capsule is truly centered')
      assert.equal(await page.locator('.hero-ring-button .ring-origin').count(), 1)
      assert.equal(await page.locator('.topic-progress .ring-origin').count(), 6)
      assert.equal(
        await page.locator('.hero-ring-button .ring-end-glow').evaluate(el => getComputedStyle(el).animationName),
        'ring-breathe'
      )
      await page.screenshot({ path: `${output}/home-${scheme}-390.png`, fullPage: true })
      const beforeMode = await page.locator('.mode-switch button[aria-pressed="true"]').getAttribute('aria-label')
      await modes.getByRole('button', { name: '环境词表', exact: true }).click()
      const vocab = page.getByRole('dialog', { name: '环境', exact: true })
      await vocab.waitFor()
      await page.keyboard.press('Escape')
      await vocab.waitFor({ state: 'hidden' })
      assert.equal(
        await page.locator('.mode-switch button[aria-pressed="true"]').getAttribute('aria-label'),
        beforeMode,
        'vocabulary action does not switch study mode'
      )
      await page.locator('.hero-ring-button').click()
      const overview = page.getByRole('dialog', { name: '学习概览', exact: true })
      await overview.waitFor()
      await page.waitForTimeout(600)
      const meters = await overview.locator('.overview-meters').boundingBox()
      assert.ok(meters.width <= 185 && Math.abs(meters.x + meters.width / 2 - 195) < 1)
      assert.ok(
        (await overview
          .locator('.overview-meter')
          .first()
          .evaluate(el => getComputedStyle(el, '::before').content)) !== 'none'
      )
      await page.screenshot({ path: `${output}/overview-${scheme}-390.png`, fullPage: true })
      await page.mouse.click(15, 140)
      await overview.waitFor({ state: 'hidden' })
      await page.getByRole('button', { name: '偏好设置', exact: true }).click()
      const prefs = page.getByRole('dialog', { name: '偏好', exact: true })
      await prefs.waitFor()
      await page.waitForTimeout(500)
      assert.equal(await prefs.locator('.goal-value').evaluate(el => getComputedStyle(el).fontSize), '12px')
      await page.screenshot({ path: `${output}/preferences-${scheme}-390.png`, fullPage: true })
      const slider = prefs.getByRole('slider'),
        range = await slider.boundingBox(),
        haptics = await page.evaluate(() => window.haptics.length)
      await page.mouse.move(range.x + 10 + (range.width - 20) / 3, range.y + range.height / 2)
      await page.mouse.down()
      await page.mouse.move(range.x + range.width * 0.73, range.y + range.height / 2, { steps: 12 })
      await page.waitForTimeout(240)
      assert.equal(await prefs.locator('.goal-floating-value').evaluate(el => getComputedStyle(el).opacity), '1')
      assert.ok((await page.evaluate(() => window.haptics.length)) > haptics)
      await page.screenshot({ path: `${output}/preferences-dragging-${scheme}-390.png`, fullPage: true })
      await page.mouse.up()
      await page.waitForTimeout(260)
      await slider.focus()
      await page.keyboard.press('Home')
      await page.keyboard.press('ArrowRight')
      assert.equal(await slider.getAttribute('aria-valuetext'), '20 个')
      await page.keyboard.press('Escape')
      await prefs.waitFor({ state: 'hidden' })
      await startStudy(page)
      await page.locator('#word-wrap').waitFor()
      await page.waitForTimeout(450)
      assert.equal(await page.locator('.typing-caret').count(), 0, 'learning has no typing cursor')
      const position = await page.locator('.typing-core .letter').evaluate(el => {
        const r = el.getBoundingClientRect()
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 }
      })
      assert.ok(Math.abs(position.x - 195) < 1, 'learning word is horizontally centered')
      assert.ok(Math.abs(position.y - 844 * 0.382) < 20, 'word is near the golden-section height')
      const tools = await page.locator('.word-tools').boundingBox(),
        progress = page.getByRole('progressbar', { name: '本组学习进度' })
      const p = await progress.boundingBox()
      assert.equal(p.width, 32)
      assert.ok(p.y >= tools.y + tools.height && p.y < tools.y + tools.height + 30)
      await page.screenshot({ path: `${output}/learning-${scheme}-390.png`, fullPage: true })
      const old = await progress.getAttribute('aria-valuenow'),
        wordBox = await page.locator('#word-wrap').boundingBox()
      await page.mouse.move(wordBox.x + wordBox.width / 2, wordBox.y + 20)
      await page.mouse.down()
      await page.mouse.move(wordBox.x + wordBox.width / 2 - 120, wordBox.y + 20, { steps: 8 })
      await page.mouse.up()
      await page.waitForTimeout(500)
      assert.notEqual(await progress.getAttribute('aria-valuenow'), old, 'mini progress reflects a real word change')
      await page.getByRole('link', { name: '保存并返回' }).click()
      await page.locator('.hero-ring-button:enabled').waitFor()
      for (const mode of [
        { label: '打字', name: 'typing' },
        { label: '听写', name: 'listening' },
      ]) {
        await page.getByRole('button', { name: mode.label, exact: true }).click()
        await page.locator('.hero-ring-button:enabled').waitFor()
        await startStudy(page)
        await page.locator('#word-wrap').waitFor()
        await page.waitForTimeout(400)
        assert.equal(await page.locator('.typing-caret').count(), 1)
        const word = await page.evaluate(() => window.spoken.filter(v => v.volume > 0).at(-1).text)
        await type(page, word.slice(0, 4))
        await page.waitForTimeout(180)
        await page.screenshot({ path: `${output}/${mode.name}-${scheme}-390.png`, fullPage: true })
        await page.getByRole('link', { name: '保存并返回' }).click()
        await page.locator('.hero-ring-button:enabled').waitFor()
      }
      await page.getByRole('button', { name: '选择主题', exact: true }).click()
      assert.equal(await page.getByRole('menu', { name: '主题', exact: true }).getByRole('menuitemradio').count(), 6)
      assert.ok((await page.evaluate(() => window.haptics)).every(n => n === 8))
      assert.deepEqual(errors, [])
      console.log(
        `PASS: ${scheme} centered four-part capsule, soft zero origins, compact overview, learning without cursor, golden-section word/tools/progress, quiet preference values, typing/listening carets`
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

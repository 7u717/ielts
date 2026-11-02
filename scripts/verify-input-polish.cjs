const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const { startStudy } = require('./mobile-actions.cjs')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const base = process.env.IELTS_TEST_URL || 'http://127.0.0.1:4173/ielts/'
const output = process.env.IELTS_SCREENSHOTS || '/tmp/ielts-input-polish'
fs.mkdirSync(output, { recursive: true })
async function type(page, text) {
  for (const c of text) {
    await page.evaluate(c => {
      const input = document.querySelector('#typing-listener')
      input.value = ' ' + c
      input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: c }))
    }, c)
    await page.waitForTimeout(35)
  }
}
async function backspace(page) {
  await page.evaluate(() => {
    const input = document.querySelector('#typing-listener')
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }))
  })
}
;(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] })
  try {
    for (const scheme of ['dark', 'light'])
      for (const mode of [
        { label: '打字', name: 'typing' },
        { label: '听写', name: 'listening' },
      ]) {
        const ctx = await browser.newContext({
          viewport: { width: 390, height: 844 },
          deviceScaleFactor: 2,
          isMobile: true,
          hasTouch: true,
          colorScheme: scheme,
        })
        await ctx.route('https://dict.youdao.com/**', route => route.abort())
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
        const rings = page.locator('.topic-progress .ring-track')
        assert.equal(await rings.count(), 6)
        assert.ok(
          (await rings.evaluateAll(nodes => nodes.map(n => n.getAttribute('stroke-dasharray')))).every(n => n === null)
        )
        const boxes = await page.locator('.topic-progress-item').evaluateAll(nodes =>
          nodes.map(n => {
            const r = n.getBoundingClientRect(),
              ring = n.querySelector('.iue-ring').getBoundingClientRect()
            return { x: r.x, width: r.width, ringX: ring.x, ringWidth: ring.width, bottom: r.bottom }
          })
        )
        assert.ok(
          boxes.every(b => Math.abs(b.ringX + b.ringWidth / 2 - (b.x + b.width / 2)) < 1),
          'mini rings are centered vertically above their names'
        )
        const nav = await page.getByRole('tablist').boundingBox()
        assert.ok(boxes.every(b => b.bottom < nav.y))
        if (mode.name === 'typing') {
          await page.screenshot({ path: `${output}/home-${scheme}-390.png`, fullPage: true })
          await page.locator('.hero-ring-button').click()
          const overview = page.getByRole('dialog', { name: '学习概览', exact: true })
          await overview.waitFor()
          await page.waitForTimeout(600)
          assert.ok(!/今日|已学/.test(await overview.innerText()))
          assert.equal(await overview.getByRole('progressbar').count(), 2)
          assert.ok(
            (await overview
              .locator('.overview-meter-row small')
              .first()
              .evaluate(el => parseFloat(getComputedStyle(el).fontSize))) <= 10
          )
          await page.screenshot({ path: `${output}/overview-${scheme}-390.png`, fullPage: true })
          await page.keyboard.press('Escape')
          await overview.waitFor({ state: 'hidden' })
        }
        await page.getByRole('button', { name: mode.label, exact: true }).click()
        await page.locator('.hero-ring-button:enabled').waitFor()
        await startStudy(page)
        await page.locator('#word-wrap').waitFor()
        await page.waitForTimeout(450)
        const target = await page.evaluate(() => window.spoken.filter(u => u.volume > 0).at(-1).text)
        assert.equal(await page.locator('.typing-word.minimal-input').count(), 1)
        assert.equal(await page.locator('.practice-hairline').count(), 0)
        assert.equal(await page.locator('.word-tools button').count(), 2)
        assert.ok(!(await page.locator('.word-tools').innerHTML()).includes('M5 12h.01'))
        const style = await page.locator('#word-wrap').evaluate(el => ({
          border: getComputedStyle(el).borderTopWidth,
          background: getComputedStyle(el).backgroundColor,
          line: getComputedStyle(el, '::after').height,
        }))
        assert.equal(style.border, '0px')
        assert.equal(style.background, 'rgba(0, 0, 0, 0)')
        assert.equal(style.line, '0.5px')
        assert.equal(await page.locator('.typing-caret').count(), 1)
        if (mode.name === 'listening') {
          assert.equal(
            (await page.locator('#word-wrap').innerText()).trim(),
            '',
            'listening starts with a cursor instead of answer-length dots'
          )
          await page.screenshot({ path: `${output}/listening-empty-${scheme}-390.png`, fullPage: true })
        }
        const before = await page.evaluate(() => window.haptics.length)
        await type(page, target[0] === 'x' ? 'q' : 'x')
        assert.ok((await page.evaluate(() => window.haptics.length)) > before, 'errors vibrate')
        const wrong = page.locator('.typing-core .wrong').first()
        assert.equal(
          await wrong.evaluate(el => getComputedStyle(el).color),
          scheme === 'dark' ? 'rgb(233, 170, 170)' : 'rgb(182, 78, 89)'
        )
        assert.ok(
          (await page.locator('.typing-core').evaluate(el => getComputedStyle(el).animationName)).startsWith(
            'typing-error'
          )
        )
        await page.screenshot({ path: `${output}/${mode.name}-error-${scheme}-390.png`, fullPage: true })
        await backspace(page)
        await type(page, target.slice(0, 4))
        await page.waitForTimeout(200)
        assert.equal(await page.locator('.typing-core .l').count(), 4)
        await page.screenshot({ path: `${output}/${mode.name}-${scheme}-390.png`, fullPage: true })
        await type(page, target.slice(4, -1))
        const finish = await page.evaluate(async c => {
          const input = document.querySelector('#typing-listener')
          input.value = ' ' + c
          input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: c }))
          await new Promise(requestAnimationFrame)
          const core = document.querySelector('.typing-core')
          return {
            correct: core.classList.contains('is-complete'),
            glow: getComputedStyle(core, '::before').animationName,
          }
        }, target.at(-1))
        assert.equal(finish.correct, true)
        assert.ok(finish.glow.startsWith('completion-wash'))
        await page.waitForFunction(old => window.spoken.filter(u => u.volume > 0).at(-1)?.text !== old, target)
        await page.waitForTimeout(400)
        assert.equal(await page.locator('.typing-core .l').count(), 0, 'correct answer advances automatically')
        assert.deepEqual(errors, [])
        assert.ok((await page.evaluate(() => window.haptics)).every(n => n === 8))
        console.log(
          `PASS: ${scheme} ${mode.name}, centered complete rings, graphic overview, frameless input/caret, letter motion, wrong shake/haptic, completion glow and automatic next word`
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

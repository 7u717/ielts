const { startStudy } = require('./mobile-actions.cjs')
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const output = process.env.IELTS_SCREENSHOTS || '/tmp/ielts-study-polish'
const base = process.env.IELTS_TEST_URL || 'http://127.0.0.1:4173/ielts/'
fs.mkdirSync(output, { recursive: true })
;(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] })
  try {
    const ctx = await browser.newContext({
      colorScheme: 'dark',
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    })
    await ctx.route('https://dict.youdao.com/**', route => route.abort())
    await ctx.addInitScript(() => {
      HTMLMediaElement.prototype.play = function () {
        return this.src.startsWith('https:') ? Promise.reject(new Error('fixture')) : Promise.resolve()
      }
      speechSynthesis.speak = u =>
        queueMicrotask(() => {
          u.onstart?.()
          u.onend?.()
        })
    })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', e => errors.push(e.message))
    await page.goto(base, { waitUntil: 'networkidle' })
    await page.locator('.hero-ring-button:enabled').waitFor()
    assert.equal(await page.getByRole('heading', { name: '主题进度' }).count(), 0)
    assert.equal(await page.locator('.ring-percent,.ring-peek,.subtle-link').count(), 0)
    await page.screenshot({ path: `${output}/home-390.png`, fullPage: true })
    await page.locator('.topic-progress-item').first().click()
    await page.locator('.ring-peek').waitFor()
    await page.locator('.ring-peek').waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: '环境词表，上拉展开', exact: true }).click()
    const sheet = page.getByRole('dialog', { name: '环境', exact: true })
    await sheet.waitFor()
    await page.keyboard.press('Escape')
    await sheet.waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: '偏好设置', exact: true }).click()
    const prefs = page.getByRole('dialog', { name: '偏好', exact: true })
    await prefs.waitFor()
    await page.waitForTimeout(450)
    assert.equal(await prefs.evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(22, 22, 24, 0.6)')
    await page.screenshot({ path: `${output}/preferences-390.png`, fullPage: true })
    await page.keyboard.press('Escape')
    await prefs.waitFor({ state: 'hidden' })
    await startStudy(page)
    await page.waitForURL('**/practice-words/**')
    await page.locator('#word-wrap').waitFor()
    await page.waitForTimeout(400)
    await page.locator('.gesture-hint').waitFor()
    assert.equal(await page.locator('.practice-phase').count(), 0)
    assert.equal(
      await page.getByRole('link', { name: '保存并返回' }).evaluate(el => getComputedStyle(el).borderTopWidth),
      '0px'
    )
    const progress = await page.getByRole('progressbar').boundingBox()
    assert.ok(progress.y > 700 && progress.width < 60, 'progress no longer divides the header')
    const word = page.locator('#word-wrap')
    assert.equal(await word.locator('.letter').evaluate(el => getComputedStyle(el).color), 'rgb(229, 229, 234)')
    assert.ok(Number.parseFloat(await word.evaluate(el => getComputedStyle(el).fontSize)) > 46)
    const first = (await word.innerText()).replace(/\s/g, '')
    const beforeMeaning = await word.boundingBox()
    await word.click()
    await page.waitForTimeout(260)
    const box = await word.boundingBox()
    assert.ok(Math.abs(box.y - beforeMeaning.y) < 1, 'meaning reveal never shifts the word away from the finger')
    await word.click()
    await page.waitForTimeout(260)
    assert.ok(box.y > 250 && box.y < 450, 'word is centered in the study viewport')
    await page.mouse.move(box.x + box.width / 2, box.y + 25)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 - 38, box.y + 25, { steps: 5 })
    const dragged = await page
      .locator('.word-swipe-surface')
      .evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41)
    assert.ok(dragged < -25, 'left swipe follows the finger')
    await page.screenshot({ path: `${output}/study-dragging-390.png`, fullPage: true })
    await page.mouse.up()
    await page.waitForTimeout(350)
    assert.equal((await word.innerText()).replace(/\s/g, ''), first, 'short swipe does not skip')
    assert.equal(
      await page
        .locator('.word-swipe-surface')
        .evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m41),
      0,
      'short swipe returns to center'
    )
    await page.locator('.gesture-hint').waitFor({ state: 'hidden' })
    await page.screenshot({ path: `${output}/study-390.png`, fullPage: true })
    await page.mouse.move(box.x + box.width / 2, box.y + 25)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 - 125, box.y + 25, { steps: 7 })
    await page.mouse.up()
    await page.waitForTimeout(550)
    assert.notEqual((await word.innerText()).replace(/\s/g, ''), first, 'full swipe skips')
    await page.getByRole('link', { name: '保存并返回' }).click()
    await page.locator('.hero-ring-button:enabled').waitFor()
    await startStudy(page)
    await page.locator('#word-wrap').waitFor()
    await page.waitForTimeout(400)
    assert.equal(
      await page.locator('.gesture-hint').count(),
      0,
      'hint appears only once, including across lesson navigation'
    )
    await page.getByRole('link', { name: '保存并返回' }).click()
    await page.getByRole('button', { name: '选择主题', exact: true }).click()
    assert.equal(await page.getByRole('menu', { name: '主题' }).getByRole('menuitemradio').count(), 6)
    assert.deepEqual(errors, [])
    console.log(
      'PASS: quiet home, transient percentages, merged vocabulary handle, no light leak, centered bright word, once-only hint, finger tracking/rebound/skip, retained topic menu'
    )
    await ctx.close()
  } finally {
    await browser.close()
  }
})().catch(error => {
  console.error(error)
  process.exitCode = 1
})

const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const base = process.env.IELTS_TEST_URL || 'http://127.0.0.1:4173/ielts/'
const output = process.env.IELTS_SCREENSHOTS || '/tmp/ielts-sheet-polish'
fs.mkdirSync(output, { recursive: true })
;(async () => {
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] })
  try {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 2,
      isMobile: true,
      hasTouch: true,
    })
    await ctx.route('https://dict.youdao.com/**', route => route.abort())
    await ctx.addInitScript(() => {
      window.wordAudio = []
      window.haptics = []
      navigator.vibrate = ms => {
        window.haptics.push(ms)
        return true
      }
      HTMLMediaElement.prototype.play = function () {
        if (this.src.startsWith('https:')) {
          window.wordAudio.push(this.src)
          return Promise.reject(new Error('fixture failure'))
        }
        return Promise.resolve()
      }
      speechSynthesis.speak = utterance =>
        queueMicrotask(() => {
          utterance.onstart?.()
          utterance.onend?.()
        })
    })
    const page = await ctx.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(base, { waitUntil: 'networkidle' })
    await page.locator('.hero-ring-button:enabled').waitFor()
    await page.getByRole('button', { name: '环境词表', exact: false }).click()
    const sheet = page.getByRole('dialog', { name: '环境', exact: true })
    await sheet.waitFor()
    await page.waitForTimeout(700)
    assert.equal(await sheet.getByRole('button', { name: '关闭', exact: true }).count(), 0)
    assert.equal(await sheet.locator('.vocabulary-word').count(), 24)
    assert.equal(await sheet.locator('.vocabulary-word svg').count(), 0)
    const word = sheet.getByRole('button', { name: 'biodiversity', exact: true })
    assert.equal(await word.evaluate(el => getComputedStyle(el).borderBottomWidth), '0px')
    assert.equal(await sheet.locator('.sheet-body').evaluate(el => getComputedStyle(el).scrollbarWidth), 'none')
    await page.screenshot({ path: `${output}/vocabulary-390.png`, fullPage: true })
    const count = () => page.evaluate(() => window.wordAudio.length)
    const before = await count()
    await word.click()
    assert.ok((await count()) > before, 'first word tap plays audio')
    assert.equal(await page.locator('.vocabulary-detail[open]').count(), 0)
    await word.click()
    const detail = page.getByRole('dialog', { name: 'biodiversity', exact: true })
    await detail.waitFor()
    await page.waitForTimeout(260)
    assert.equal(await sheet.isVisible(), true, 'list remains underneath detail')
    await page.screenshot({ path: `${output}/word-detail-390.png`, fullPage: true })
    await page.mouse.click(15, 150)
    await detail.waitFor({ state: 'hidden' })
    const other = sheet.getByRole('button', { name: 'sustainability', exact: true })
    const box = await other.boundingBox()
    await page.mouse.move(box.x + 80, box.y + 20)
    await page.mouse.down()
    await page.waitForTimeout(480)
    await page.mouse.up()
    const heldDetail = page.getByRole('dialog', { name: 'sustainability', exact: true })
    await heldDetail.waitFor()
    await page.keyboard.press('Escape')
    await heldDetail.waitFor({ state: 'hidden' })
    await sheet.locator('.sheet-body').evaluate(el => {
      el.scrollTop = el.scrollHeight
    })
    await sheet.getByRole('button', { name: 'sustainable', exact: true }).waitFor()
    await page.keyboard.press('Escape')
    await sheet.waitFor({ state: 'hidden' })
    await page.locator('.avatar-button').click()
    const preferences = page.getByRole('dialog', { name: '偏好', exact: true })
    await preferences.waitFor()
    await page.waitForTimeout(420)
    const slider = preferences.getByRole('slider')
    await slider.focus()
    assert.equal(await preferences.locator('.goal-dial').evaluate(el => getComputedStyle(el).outlineStyle), 'none')
    const switchRow = preferences.getByRole('switch')
    assert.ok((await switchRow.boundingBox()).width > 300, 'whole row is interactive')
    const state = await switchRow.getAttribute('aria-checked')
    await switchRow.click({ position: { x: 25, y: 20 } })
    assert.notEqual(await switchRow.getAttribute('aria-checked'), state, 'label side toggles the switch')
    await switchRow.click()
    await page.screenshot({ path: `${output}/preferences-390.png`, fullPage: true })
    const range = await slider.boundingBox()
    await page.mouse.move(range.x + 10 + (range.width - 20) / 3, range.y + range.height / 2)
    await page.mouse.down()
    await page.mouse.move(range.x + range.width * 0.72, range.y + range.height / 2, { steps: 12 })
    await page.waitForTimeout(180)
    assert.equal(await preferences.locator('.goal-dial').getAttribute('class'), 'goal-dial dragging')
    assert.equal(await preferences.locator('.goal-floating-value').evaluate(el => getComputedStyle(el).opacity), '1')
    const position = Number(await slider.inputValue())
    assert.ok(position % 1 > 0.01, 'thumb moves continuously between stops')
    await page.screenshot({ path: `${output}/preferences-dragging-390.png`, fullPage: true })
    await page.mouse.up()
    await page.waitForTimeout(250)
    assert.equal(Number(await slider.inputValue()) % 1, 0, 'release snaps to a stop')
    await slider.focus()
    await page.keyboard.press('End')
    assert.equal(await slider.getAttribute('aria-valuetext'), '40 个')
    await page.keyboard.press('Escape')
    await preferences.waitFor({ state: 'hidden' })
    await page.getByRole('button', { name: '选择主题', exact: true }).click()
    const menu = page.getByRole('menu', { name: '主题' })
    await menu.waitFor()
    assert.equal(await menu.getByRole('menuitemradio').count(), 6)
    assert.ok((await page.evaluate(() => window.haptics.length)) > 0)
    assert.deepEqual(errors, [])
    console.log(
      'PASS: 390px vocabulary list, tap sound, repeat/hold details, scroll/dismiss, continuous goal drag/snap, full-row switch, intact theme menu'
    )
    await ctx.close()
  } finally {
    await browser.close()
  }
})().catch(error => {
  console.error(error)
  process.exitCode = 1
})

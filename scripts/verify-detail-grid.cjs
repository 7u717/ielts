const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const { headerAction, startStudy } = require('./mobile-actions.cjs')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const output = process.env.IELTS_SCREENSHOTS || '/tmp/ielts-detail-grid'
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
      window.audioWords = []
      window.haptics = []
      navigator.vibrate = ms => {
        window.haptics.push(ms)
        return true
      }
      HTMLMediaElement.prototype.play = function () {
        if (this.src.startsWith('https:')) {
          window.audioWords.push(this.src)
          return Promise.reject(new Error('fixture'))
        }
        return Promise.resolve()
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
    const items = page.locator('.topic-progress-item')
    assert.equal(await items.count(), 6)
    const tabs = await page.getByRole('tablist').boundingBox()
    const bounds = await items.evaluateAll(nodes =>
      nodes.map(n => {
        const r = n.getBoundingClientRect()
        return { left: r.left, right: r.right, top: r.top, bottom: r.bottom }
      })
    )
    assert.ok(
      bounds.every(r => r.left >= 0 && r.right <= 390 && r.bottom < tabs.y),
      'all six topics fit above navigation'
    )
    assert.ok(bounds[3].top > bounds[0].top)
    assert.equal(
      await page.locator('.topic-progress .ring-dot,.topic-progress .ring-arc').count(),
      0,
      'zero progress has no orphan endpoint or arc'
    )
    assert.equal(await page.locator('.vocabulary-entry-button').count(), 1)
    await page.screenshot({ path: `${output}/home-six-390.png`, fullPage: true })
    await page.getByRole('button', { name: '环境词表', exact: true }).click()
    const vocabulary = page.getByRole('dialog', { name: '环境', exact: true })
    await vocabulary.waitFor()
    await page.waitForTimeout(550)
    assert.equal(await vocabulary.locator('.vocabulary-heading').innerText(), '环境')
    assert.equal(await vocabulary.getByText('生物多样性', { exact: true }).isVisible(), false)
    await page.screenshot({ path: `${output}/vocabulary-390.png`, fullPage: true })
    const entry = vocabulary.getByRole('button', { name: 'biodiversity', exact: true })
    await entry.click()
    await page.waitForTimeout(350)
    assert.equal(await entry.getAttribute('aria-expanded'), 'true')
    const audioCount = await page.evaluate(() => window.audioWords.length)
    await vocabulary.getByRole('button', { name: '播放 biodiversity 发音', exact: true }).click()
    assert.ok((await page.evaluate(() => window.audioWords.length)) > audioCount)
    await page.screenshot({ path: `${output}/vocabulary-expanded-390.png`, fullPage: true })
    await entry.click()
    await page.waitForTimeout(350)
    assert.equal(await entry.getAttribute('aria-expanded'), 'false')
    await page.keyboard.press('Escape')
    await vocabulary.waitFor({ state: 'hidden' })
    await startStudy(page)
    await page.waitForURL('**/practice-words/**')
    await page.locator('#word-wrap').waitFor()
    assert.equal(await page.locator('.practice-header .header-actions > button').count(), 0)
    await page.getByRole('button', { name: '学习工具', exact: true }).click()
    const menu = page.getByRole('menu', { name: '学习工具', exact: true })
    await menu.waitFor()
    await page.waitForTimeout(750)
    assert.equal(await menu.getByRole('menuitem').count(), 2)
    const buttons = await menu
      .getByRole('menuitem')
      .evaluateAll(nodes =>
        nodes.map(n => ({ width: n.getBoundingClientRect().width, delay: getComputedStyle(n).transitionDelay }))
      )
    assert.equal(buttons[0].width, 38)
    assert.equal(buttons[1].delay, '0.05s')
    await page.screenshot({ path: `${output}/study-tools-390.png`, fullPage: true })
    await page.keyboard.press('Escape')
    await menu.waitFor({ state: 'hidden' })
    await headerAction(page, '打开键盘')
    await page.waitForTimeout(450)
    await page.getByRole('button', { name: '单词详情', exact: true }).click()
    const detail = page.getByRole('dialog', { name: 'biodiversity', exact: true })
    await detail.waitFor()
    await page.waitForTimeout(450)
    assert.equal(await detail.getByRole('button', { name: '关闭', exact: true }).count(), 0)
    assert.equal(
      await detail.locator('.detail-word-heading h2').evaluate(el => getComputedStyle(el).textAlign),
      'center'
    )
    await detail.getByRole('button', { name: '播放发音', exact: true }).click()
    const bookmark = detail.getByRole('button', { name: '收藏', exact: true })
    await bookmark.click()
    await page.waitForTimeout(400)
    assert.equal(await bookmark.getAttribute('aria-pressed'), 'true')
    assert.equal(await bookmark.locator('svg').evaluate(el => getComputedStyle(el).fill), 'rgb(229, 229, 234)')
    await page.screenshot({ path: `${output}/word-detail-390.png`, fullPage: true })
    await detail.getByRole('button', { name: '笔记', exact: true }).click()
    await detail.getByRole('textbox', { name: '单词笔记' }).fill('保留在本机的笔记')
    await detail.getByRole('button', { name: '保存', exact: true }).click()
    const handle = await detail.locator('.sheet-grab').boundingBox()
    await page.mouse.move(handle.x + handle.width / 2, handle.y + 12)
    await page.mouse.down()
    await page.mouse.move(handle.x + handle.width / 2, handle.y + 43, { steps: 5 })
    await page.mouse.up()
    await page.waitForTimeout(450)
    assert.equal(await detail.isVisible(), true, 'short pull rebounds')
    assert.equal(await detail.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42), 0)
    await page.mouse.click(12, 120)
    await detail.waitFor({ state: 'hidden' })
    await headerAction(page, '偏好设置')
    const prefs = page.getByRole('dialog', { name: '偏好', exact: true })
    await prefs.waitFor()
    await page.waitForTimeout(450)
    assert.equal(await prefs.evaluate(el => getComputedStyle(el).backgroundColor), 'rgba(22, 22, 24, 0.6)')
    await page.screenshot({ path: `${output}/preferences-390.png`, fullPage: true })
    await page.keyboard.press('Escape')
    await prefs.waitFor({ state: 'hidden' })
    await page.getByRole('link', { name: '保存并返回' }).click()
    await page.locator('.hero-ring-button:enabled').waitFor()
    await page.reload({ waitUntil: 'networkidle' })
    await page.locator('.hero-ring-button:enabled').waitFor()
    await startStudy(page)
    await page.locator('#word-wrap').waitFor()
    await page.getByRole('button', { name: '单词详情', exact: true }).click()
    await detail.waitFor()
    assert.equal(await detail.getByRole('button', { name: '收藏', exact: true }).getAttribute('aria-pressed'), 'true')
    assert.ok((await detail.innerText()).includes('保留在本机的笔记'))
    assert.deepEqual(errors, [])
    assert.ok((await page.evaluate(() => window.haptics)).every(n => n === 8))
    console.log(
      'PASS: six-topic grid, no zero endpoints, inline vocabulary, lk study tools, centered glass details, bookmark/note persistence, rebound and dismissal'
    )
    await ctx.close()
  } finally {
    await browser.close()
  }
})().catch(e => {
  console.error(e)
  process.exitCode = 1
})

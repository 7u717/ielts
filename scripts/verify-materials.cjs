const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const { startStudy } = require('./mobile-actions.cjs')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const output = process.env.IELTS_SCREENSHOTS || '/tmp/ielts-materials'
const base = process.env.IELTS_TEST_URL || 'http://127.0.0.1:4173/ielts/'
fs.mkdirSync(output, { recursive: true })
async function saved(page, value) {
  return page.evaluate(
    async ({ value, write }) => {
      const db = await new Promise(resolve => {
        const r = indexedDB.open('keyval-store')
        r.onsuccess = () => resolve(r.result)
      })
      return new Promise(resolve => {
        const tx = db.transaction('keyval', write ? 'readwrite' : 'readonly'),
          os = tx.objectStore('keyval')
        if (write) {
          os.put(JSON.stringify(value), 'typing-word-dict')
          tx.oncomplete = resolve
        } else {
          const r = os.get('typing-word-dict')
          r.onsuccess = () => resolve(JSON.parse(r.result))
        }
      })
    },
    { value, write: arguments.length === 2 }
  )
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
        window.testHaptics = []
        navigator.vibrate = n => {
          window.testHaptics.push(n)
          return true
        }
        HTMLMediaElement.prototype.play = function () {
          return this.src.startsWith('https:') ? Promise.reject(new Error('fixture')) : Promise.resolve()
        }
        speechSynthesis.speak = u =>
          queueMicrotask(() => {
            u.onstart?.()
            u.onend?.()
          })
      })
      const page = await ctx.newPage(),
        errors = []
      page.on('pageerror', e => errors.push(e.message))
      await page.goto(base, { waitUntil: 'networkidle' })
      await page.locator('.hero-ring-button:enabled').waitFor()
      assert.equal(await page.locator('html').getAttribute('data-appearance'), scheme)
      assert.equal(await page.locator('.hero-ring-button .ring-arc').count(), 0)
      assert.equal(await page.locator('.hero-ring-button .ring-origin').count(), 1)
      assert.equal(await page.locator('.hero-ring-button .ring-end-glow').count(), 1)
      assert.equal((await page.locator('.hero-ring-button').innerText()).trim(), '环境')
      assert.equal(await page.locator('.hero-meta,.resume-label,.overview-grab').count(), 0)
      assert.equal(
        await page
          .locator('.topic-progress .iue-ring')
          .first()
          .evaluate(el => el.getBoundingClientRect().width),
        42
      )
      assert.equal(await page.getByRole('group', { name: '学习模式' }).innerText(), '')
      assert.equal(
        await page
          .locator('.small .ring-track')
          .first()
          .evaluate(el => getComputedStyle(el).vectorEffect),
        'none'
      )
      await page.screenshot({ path: `${output}/home-${scheme}-390.png`, fullPage: true })
      await page.locator('.hero-ring-button').click()
      const overview = page.getByRole('dialog', { name: '学习概览', exact: true })
      await overview.waitFor()
      await page.waitForTimeout(430)
      assert.ok(!/今日|已学/.test(await overview.innerText()))
      assert.equal(await overview.getByRole('progressbar').count(), 2)
      assert.equal(await overview.locator('.meter-peek').count(), 0)
      await page.screenshot({ path: `${output}/overview-${scheme}-390.png`, fullPage: true })
      await page.keyboard.press('Escape')
      await overview.waitFor({ state: 'hidden' })
      await page.getByRole('button', { name: '打字', exact: true }).click()
      await page.waitForFunction(
        () => document.querySelector('.mode-switch button[aria-label="打字"]').getAttribute('aria-pressed') === 'true'
      )
      const bar = await page.locator('.mode-switch').boundingBox()
      await page.mouse.move(bar.x + 85, bar.y + 22)
      await page.mouse.down()
      await page.mouse.move(bar.x + 140, bar.y + 22, { steps: 8 })
      await page.mouse.up()
      await page.waitForFunction(
        () => document.querySelector('.mode-switch button[aria-label="听写"]').getAttribute('aria-pressed') === 'true'
      )
      await page.getByRole('button', { name: '学习', exact: true }).click()
      await page.locator('.hero-ring-button:enabled').waitFor()
      await page.getByRole('button', { name: '教育，已学 0%', exact: true }).click()
      await page.waitForTimeout(650)
      assert.equal(await page.locator('.hero-topic').innerText(), '教育')
      await page.getByRole('button', { name: '环境，已学 0%', exact: true }).click()
      await page.locator('.hero-ring-button:enabled').waitFor()
      await page.waitForTimeout(400)
      await page.getByRole('button', { name: '偏好设置', exact: true }).click()
      const prefs = page.getByRole('dialog', { name: '偏好', exact: true })
      await prefs.waitFor()
      await page.waitForTimeout(470)
      const glass = await prefs.evaluate(el => {
        const s = getComputedStyle(el)
        return { background: s.backgroundColor, blur: s.backdropFilter, border: s.borderTopWidth }
      })
      assert.ok(glass.blur.includes('blur(24px)'))
      assert.ok(glass.background.includes(scheme === 'dark' ? '0.6' : '0.56'))
      assert.notEqual(glass.border, '0px')
      await page.screenshot({ path: `${output}/preferences-${scheme}-390.png`, fullPage: true })
      await page.keyboard.press('Escape')
      await prefs.waitFor({ state: 'hidden' })
      await page.getByRole('button', { name: '环境词表', exact: true }).click()
      const vocab = page.getByRole('dialog', { name: '环境', exact: true })
      await vocab.waitFor()
      await page.waitForTimeout(470)
      await vocab.getByRole('button', { name: 'biodiversity', exact: true }).click()
      await page.waitForTimeout(340)
      await page.screenshot({ path: `${output}/vocabulary-${scheme}-390.png`, fullPage: true })
      const handle = await vocab.locator('.sheet-grab').boundingBox()
      await page.mouse.move(handle.x + handle.width / 2, handle.y + 10)
      await page.mouse.down()
      await page.mouse.move(handle.x + handle.width / 2, handle.y + 45, { steps: 6 })
      await page.mouse.up()
      await page.waitForTimeout(470)
      assert.ok(await vocab.isVisible())
      assert.equal(await vocab.evaluate(el => new DOMMatrixReadOnly(getComputedStyle(el).transform).m42), 0)
      await page.mouse.move(handle.x + handle.width / 2, handle.y + 10)
      await page.mouse.down()
      await page.mouse.move(handle.x + handle.width / 2, handle.y + 130, { steps: 8 })
      await page.mouse.up()
      await vocab.waitFor({ state: 'hidden' })
      await startStudy(page)
      await page.locator('#word-wrap').waitFor()
      await page.getByRole('button', { name: '学习工具', exact: true }).click()
      const tools = page.getByRole('menu', { name: '学习工具', exact: true })
      await tools.waitFor()
      await page.waitForTimeout(680)
      assert.equal(await tools.getByRole('menuitem').count(), 2)
      assert.equal(
        await tools
          .getByRole('menuitem')
          .innerText()
          .catch(() => ''),
        ''
      )
      assert.equal(await tools.locator('span').count(), 0)
      await page.screenshot({ path: `${output}/tools-${scheme}-390.png`, fullPage: true })
      await page.keyboard.press('Escape')
      await tools.waitFor({ state: 'hidden' })
      await page.getByRole('button', { name: '单词详情', exact: true }).click()
      const detail = page.getByRole('dialog', { name: 'biodiversity', exact: true })
      await detail.waitFor()
      await page.waitForTimeout(470)
      await page.screenshot({ path: `${output}/detail-${scheme}-390.png`, fullPage: true })
      await page.keyboard.press('Escape')
      await detail.waitFor({ state: 'hidden' })
      await page.getByRole('link', { name: '保存并返回' }).click()
      await page.locator('.hero-ring-button:enabled').waitFor()
      const value = await saved(page),
        dict = value.val.word.bookList.find(d => d.id === 'ielts-environment')
      dict.lastLearnIndex = 6
      dict.statistics.push({
        startDate: new Date().toISOString(),
        endDate: new Date().toISOString(),
        new: 4,
        review: 0,
        wrong: 0,
        time: 60,
      })
      value.val.noteData.materialSentinel = '已有笔记'
      await saved(page, value)
      await page.reload({ waitUntil: 'networkidle' })
      await page.locator('.hero-ring-button:enabled').waitFor()
      assert.equal(await page.locator('.hero-ring-button .ring-end-glow').count(), 1)
      assert.equal(
        await page.locator('.hero-ring-button .ring-arc').evaluate(el => getComputedStyle(el).strokeLinecap),
        'round'
      )
      await page.screenshot({ path: `${output}/progress-${scheme}-390.png`, fullPage: true })
      await page.emulateMedia({ reducedMotion: 'reduce', colorScheme: scheme })
      assert.equal(await page.locator('.ring-end-glow').evaluate(el => getComputedStyle(el).animationName), 'none')
      await page.emulateMedia({ reducedMotion: 'no-preference', colorScheme: scheme })
      const beforeTheme = JSON.stringify(await saved(page))
      await page.emulateMedia({ colorScheme: scheme === 'dark' ? 'light' : 'dark' })
      await page.waitForTimeout(120)
      assert.equal(await page.locator('html').getAttribute('data-appearance'), scheme === 'dark' ? 'light' : 'dark')
      assert.equal(JSON.stringify(await saved(page)), beforeTheme, 'appearance changes do not rewrite learning records')
      await page.emulateMedia({ colorScheme: scheme })
      await page.getByRole('button', { name: '选择主题', exact: true }).click()
      assert.equal(await page.getByRole('menu', { name: '主题', exact: true }).getByRole('menuitemradio').count(), 6)
      assert.deepEqual(errors, [])
      console.log(
        `PASS: ${scheme} 390px glass sheets, empty/progress rings, overview, icon modes/drag, compact topics, damping, tool labels, system appearance without data writes`
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

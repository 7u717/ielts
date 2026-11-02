const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const { startStudy } = require('./mobile-actions.cjs')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const base = process.env.IELTS_TEST_URL || 'http://127.0.0.1:4173/ielts/'
const output = process.env.IELTS_SCREENSHOTS || '/tmp/ielts-light-glass'
fs.mkdirSync(output, { recursive: true })
async function record(page, value) {
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
async function fits(page) {
  const bounds = await page.locator('.typing-core').evaluate(el => {
    const r = el.getBoundingClientRect()
    return { left: r.left, right: r.right, height: r.height, wrap: getComputedStyle(el).whiteSpace }
  })
  assert.ok(bounds.left >= 31.5 && bounds.right <= 358.5, `32px word margins: ${JSON.stringify(bounds)}`)
  assert.equal(bounds.wrap, 'nowrap')
  assert.ok(bounds.height < 100)
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
        HTMLMediaElement.prototype.play = function () {
          return this.src.startsWith('https:') ? Promise.reject(new Error('fixture')) : Promise.resolve()
        }
        speechSynthesis.speak = u =>
          queueMicrotask(() => {
            u.onstart?.()
            u.onend?.()
          })
        window.haptics = []
        navigator.vibrate = n => {
          window.haptics.push(n)
          return true
        }
      })
      const page = await ctx.newPage(),
        errors = []
      page.on('pageerror', e => errors.push(e.message))
      await page.goto(base, { waitUntil: 'networkidle' })
      await page.locator('.hero-ring-button:enabled').waitFor()
      await page.getByRole('button', { name: '教育，已学 0%', exact: true }).click()
      await page.locator('.hero-ring-button:enabled').waitFor()
      await page.getByRole('button', { name: '环境，已学 0%', exact: true }).click()
      await page.locator('.hero-ring-button:enabled').waitFor()
      const value = await record(page)
      value.val.word.bookList.find(d => d.id === 'ielts-education').lastLearnIndex = 6
      value.val.noteData.glassSentinel = '保留已有笔记'
      await record(page, value)
      await page.reload({ waitUntil: 'networkidle' })
      await page.locator('.hero-ring-button:enabled').waitFor()
      await page.screenshot({ path: `${output}/home-${scheme}-390.png`, fullPage: true })
      await page.getByRole('button', { name: '选择主题', exact: true }).click()
      const menu = page.getByRole('menu', { name: '主题', exact: true })
      await menu.waitFor()
      await page.waitForTimeout(850)
      assert.equal(await menu.locator('.topic-orb-track').count(), 6)
      assert.equal(await menu.locator('.topic-orb-arc').count(), 1)
      assert.equal(
        await menu.getByRole('menuitemradio', { name: '教育', exact: true }).getAttribute('aria-description'),
        '已学 25%'
      )
      const orbs = await menu
        .getByRole('menuitemradio')
        .evaluateAll(nodes =>
          nodes.map(el => ({ width: el.getBoundingClientRect().width, delay: getComputedStyle(el).transitionDelay }))
        )
      assert.equal(orbs[0].width, 38)
      assert.equal(orbs[1].delay, '0.05s')
      assert.equal(orbs[5].delay, '0.25s')
      assert.equal(await page.locator('.overview-panel').evaluate(el => getComputedStyle(el).filter), 'none')
      if (scheme === 'light') {
        const mask = await page.locator('.topic-orb-backdrop').evaluate(el => getComputedStyle(el).backgroundColor)
        const alpha = Number(mask.slice(mask.lastIndexOf(',') + 1, -1))
        assert.ok(alpha > 0 && alpha < 0.04, 'light menu mask remains very faint')
      }
      await page.screenshot({ path: `${output}/topics-${scheme}-390.png`, fullPage: true })
      await page.mouse.click(15, 440)
      await menu.waitFor({ state: 'hidden' })
      await page.locator('.hero-ring-button').click()
      const overview = page.getByRole('dialog', { name: '学习概览', exact: true })
      await overview.waitFor()
      await page.waitForTimeout(600)
      assert.equal(await overview.locator('.meter-peek').count(), 0)
      assert.ok(!/\d\s*\/\s*\d/.test(await overview.innerText()))
      const floatFill = await overview.evaluate(el => getComputedStyle(el).backgroundColor)
      assert.equal(await overview.evaluate(el => getComputedStyle(el).borderTopWidth), '0px')
      assert.ok((await overview.evaluate(el => getComputedStyle(el).backdropFilter)).includes('blur(28px)'))
      await page.screenshot({ path: `${output}/overview-${scheme}-390.png`, fullPage: true })
      await overview.getByRole('button', { name: '查看今日进度数字', exact: true }).click()
      await overview.getByRole('status').waitFor()
      assert.ok((await overview.getByRole('status').innerText()).includes('20'))
      await overview.getByRole('status').waitFor({ state: 'hidden' })
      await page.mouse.click(15, 140)
      await overview.waitFor({ state: 'hidden' })
      await startStudy(page)
      await page.locator('#word-wrap').waitFor()
      await page.waitForTimeout(400)
      await fits(page)
      assert.equal(await page.locator('.typing-caret').count(), 0)
      const preview = page.getByRole('button', { name: '查看完整例句', exact: true })
      await preview.waitFor()
      assert.ok((await preview.innerText()).includes('biodiversity'))
      assert.equal(await preview.evaluate(el => getComputedStyle(el).textOverflow), 'ellipsis')
      await page.screenshot({ path: `${output}/learning-biodiversity-${scheme}-390.png`, fullPage: true })
      const line = await page.getByRole('progressbar', { name: '本组学习进度' }).boundingBox()
      assert.ok(line.y > 750 && line.width === 32)
      await preview.click()
      const detail = page.getByRole('dialog', { name: 'biodiversity', exact: true })
      await detail.waitFor()
      await page.waitForTimeout(550)
      const rect = await detail.boundingBox()
      assert.ok(Math.abs(rect.y + rect.height / 2 - 422) < 1)
      assert.ok(
        (await detail.innerText()).includes(
          'Protecting biodiversity helps ecosystems recover from environmental change.'
        )
      )
      assert.equal(await detail.getByRole('button', { name: '关闭', exact: true }).count(), 0)
      assert.equal(await detail.evaluate(el => getComputedStyle(el).backgroundColor), floatFill)
      await page.screenshot({ path: `${output}/details-${scheme}-390.png`, fullPage: true })
      await page.mouse.click(12, 100)
      await detail.waitFor({ state: 'hidden' })
      let current = (await page.locator('#word-wrap').innerText()).replace(/\s/g, '')
      for (let n = 0; n < 18 && current !== 'biodegradable'; n++) {
        const box = await page.locator('#word-wrap').boundingBox()
        await page.mouse.move(box.x + box.width / 2, box.y + 20)
        await page.mouse.down()
        await page.mouse.move(box.x + box.width / 2 - 130, box.y + 20, { steps: 7 })
        await page.mouse.up()
        await page.waitForFunction(old => {
          const word = document.querySelector('#word-wrap')
          return word && word.innerText.replace(/\s/g, '') !== old
        }, current)
        await page.waitForTimeout(320)
        current = (await page.locator('#word-wrap').innerText()).replace(/\s/g, '')
      }
      assert.equal(current, 'biodegradable')
      await fits(page)
      await page.screenshot({ path: `${output}/learning-longword-${scheme}-390.png`, fullPage: true })
      await page.getByRole('link', { name: '保存并返回' }).click()
      await page.locator('.hero-ring-button:enabled').waitFor()
      await page.getByRole('button', { name: '偏好设置', exact: true }).click()
      const prefs = page.getByRole('dialog', { name: '偏好', exact: true })
      await prefs.waitFor()
      await page.waitForTimeout(500)
      await page.screenshot({ path: `${output}/preferences-${scheme}-390.png`, fullPage: true })
      assert.deepEqual(errors, [])
      assert.ok((await page.evaluate(() => window.haptics)).every(n => n === 8))
      console.log(
        `PASS: ${scheme} lightweight glass, hidden meter numbers with tap reveal, live topic arcs and original stagger/selection, 32px single-line word fit, safe example preview/full detail, lower fixed progress, preferences`
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

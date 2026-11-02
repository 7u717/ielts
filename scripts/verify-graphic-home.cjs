const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const { startStudy } = require('./mobile-actions.cjs')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const base = process.env.IELTS_TEST_URL || 'http://127.0.0.1:4173/ielts/'
const output = process.env.IELTS_SCREENSHOTS || '/tmp/ielts-graphic-home'
fs.mkdirSync(output, { recursive: true })
async function data(page, value) {
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
async function skip(page) {
  const before = await page.locator('#word-wrap').innerText(),
    box = await page.locator('#word-wrap').boundingBox()
  await page.mouse.move(box.x + box.width * 0.8, box.y + 20)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * 0.8 - 140, box.y + 20, { steps: 8 })
  await page.mouse.up()
  await page.waitForFunction(old => document.querySelector('#word-wrap')?.innerText !== old, before)
  await page.waitForTimeout(450)
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
      const saved = await data(page)
      saved.val.word.bookList.find(d => d.id === 'ielts-environment').lastLearnIndex = 6
      saved.val.noteData.graphicSentinel = 'keep'
      saved.val.fsrsData.biodiversity = {
        due: '2020-01-01T00:00:00.000Z',
        stability: 8,
        difficulty: 4,
        reps: 3,
        lapses: 1,
        state: 2,
        elapsed_days: 4,
        scheduled_days: 9,
        learning_steps: 0,
        last_review: '2019-12-30T00:00:00.000Z',
      }
      await data(page, saved)
      await page.reload({ waitUntil: 'networkidle' })
      await page.locator('.hero-ring-button:enabled').waitFor()
      assert.equal(await page.locator('.topic-progress,.mode-controls,.mode-switch').count(), 0)
      assert.equal(await page.locator('.iue-tabs').count(), 1)
      assert.equal(await page.locator('.unified-dock button').count(), 6)
      const ring = await page.locator('.hero-ring-button').boundingBox()
      assert.equal(ring.width, 274)
      assert.ok(Math.abs(ring.x + ring.width / 2 - 195) < 1)
      await page.screenshot({ path: `${output}/home-${scheme}-390.png`, fullPage: true })
      await page.getByRole('button', { name: '选择主题', exact: true }).click()
      const menu = page.getByRole('menu', { name: '主题', exact: true })
      await menu.waitFor()
      await page.waitForTimeout(850)
      const orbs = menu.getByRole('menuitemradio')
      assert.equal(await orbs.locator('svg path').count(), 6)
      const selected = menu.getByRole('menuitemradio', { name: '环境', exact: true })
      assert.equal(
        await selected.evaluate(el => getComputedStyle(el).backgroundColor),
        scheme === 'dark' ? 'rgb(245, 245, 247)' : 'rgb(29, 29, 31)'
      )
      const other = menu.getByRole('menuitemradio', { name: '教育', exact: true })
      assert.equal(await other.locator('span').evaluate(el => getComputedStyle(el).opacity), '0')
      const box = await other.boundingBox()
      await page.mouse.move(box.x + 19, box.y + 19)
      await page.mouse.down()
      await page.waitForTimeout(500)
      await page.mouse.up()
      await page.waitForTimeout(350)
      assert.ok(await menu.isVisible())
      assert.equal(await selected.getAttribute('aria-checked'), 'true')
      assert.ok(Number(await other.locator('span').evaluate(el => getComputedStyle(el).opacity)) > 0.8)
      await page.screenshot({ path: `${output}/topics-${scheme}-390.png`, fullPage: true })
      await page.getByRole('button', { name: '选择主题', exact: true }).click()
      await menu.waitFor({ state: 'hidden' })
      await page.locator('.hero-ring-button').click()
      const overview = page.getByRole('dialog', { name: '学习概览', exact: true })
      await overview.waitFor()
      await page.waitForTimeout(450)
      const discBox = await overview.boundingBox()
      assert.equal(discBox.width, 314)
      assert.equal(discBox.height, 314)
      assert.ok(Math.abs(discBox.y + 157 - (ring.y + ring.height / 2)) < 1)
      assert.equal(await overview.evaluate(el => getComputedStyle(el).borderRadius), '50%')
      assert.equal(await overview.evaluate(el => getComputedStyle(el).boxShadow), 'none')
      assert.equal(await overview.locator('.ring-arc').count(), 2)
      assert.equal((await overview.locator('.iue-ring').boundingBox()).width, 152)
      const actualArc = await overview
        .locator('.ring-arc')
        .first()
        .evaluate(el => ({
          vector: getComputedStyle(el).vectorEffect,
          fraction: 1 - Number(el.getAttribute('stroke-dashoffset')) / Number(el.getAttribute('stroke-dasharray')),
        }))
      assert.equal(actualArc.vector, 'none')
      assert.ok(Math.abs(actualArc.fraction - 0.25) < 0.0001)
      assert.ok(
        !(
          await overview
            .locator('.ring-arc')
            .first()
            .evaluate(el => getComputedStyle(el).animationName)
        ).includes('arc-draw')
      )
      assert.ok(
        Number(
          await overview
            .locator('.ring-arc')
            .first()
            .evaluate(el => getComputedStyle(el).opacity)
        ) > Number(await overview.locator('.ring-review-arc').evaluate(el => getComputedStyle(el).opacity))
      )
      assert.equal(await page.locator('.iue-tabs').evaluate(el => getComputedStyle(el).opacity), '0')
      assert.equal(await page.locator('.ring-origin, .ring-end-glow').count(), 0)
      await page.screenshot({ path: `${output}/overview-${scheme}-390.png`, fullPage: true })
      await page.mouse.click(10, 110)
      await overview.waitFor({ state: 'hidden' })
      await page.locator('.hero-ring-button').click()
      await overview.waitFor()
      await page.waitForTimeout(450)
      const discHeading = await overview.locator('h2').boundingBox()
      await page.mouse.move(discHeading.x + discHeading.width / 2, discHeading.y + 5)
      await page.mouse.down()
      await page.mouse.move(discHeading.x + discHeading.width / 2, discHeading.y + 135, { steps: 8 })
      await page.mouse.up()
      await overview.waitFor({ state: 'hidden' })
      await page.getByRole('button', { name: '环境词表', exact: true }).click()
      const vocab = page.getByRole('dialog', { name: '环境', exact: true })
      await vocab.waitFor()
      await page.waitForTimeout(500)
      assert.equal(await vocab.locator('.vocabulary-gloss').count(), 24)
      assert.equal(
        await vocab
          .locator('.vocabulary-gloss')
          .first()
          .evaluate(el => getComputedStyle(el).opacity),
        '0.48'
      )
      assert.ok(
        (await vocab.locator('.sheet-body').evaluate(el => getComputedStyle(el).maskImage)).includes('linear-gradient')
      )
      const heights = await vocab
        .locator('.vocabulary-word')
        .evaluateAll(nodes => nodes.map(el => el.getBoundingClientRect().height))
      assert.ok(heights.every(h => h === 76))
      const vocabFill = await vocab.evaluate(el => getComputedStyle(el).backgroundColor)
      assert.equal((await vocab.boundingBox()).x, 12)
      assert.equal(await vocab.evaluate(el => getComputedStyle(el).borderTopWidth), '0px')
      assert.equal(await page.locator('.hero-ring-button').evaluate(el => getComputedStyle(el).opacity), '0')
      assert.equal(await page.locator('.iue-tabs').evaluate(el => getComputedStyle(el).opacity), '0')
      assert.equal(
        await vocab
          .locator('.vocabulary-word')
          .first()
          .evaluate(el => getComputedStyle(el).flexDirection),
        'column'
      )
      await page.screenshot({ path: `${output}/vocabulary-${scheme}-390.png`, fullPage: true })
      await vocab.getByRole('button', { name: 'biodiversity', exact: true }).click()
      const vocabDetail = page.locator('.vocabulary-detail')
      await vocabDetail.waitFor()
      await page.waitForTimeout(450)
      assert.ok((await vocabDetail.locator('.vocabulary-example').innerText()).includes('Protecting biodiversity'))
      await vocabDetail.getByRole('button', { name: '播放发音', exact: true }).click()
      await page.screenshot({ path: `${output}/vocabulary-detail-${scheme}-390.png`, fullPage: true })
      await page.mouse.click(8, 100)
      await vocabDetail.waitFor({ state: 'hidden' })
      const grab = await vocab.locator('.sheet-grab').boundingBox()
      await page.mouse.move(grab.x + grab.width / 2, grab.y + 10)
      await page.mouse.down()
      await page.mouse.move(grab.x + grab.width / 2, grab.y + 140, { steps: 8 })
      await page.mouse.up()
      await vocab.waitFor({ state: 'hidden' })
      await page.getByRole('button', { name: '偏好设置', exact: true }).click()
      const prefs = page.getByRole('dialog', { name: '偏好', exact: true })
      await prefs.waitFor()
      await page.waitForTimeout(450)
      assert.equal(await prefs.evaluate(el => getComputedStyle(el).backgroundColor), vocabFill)
      assert.equal(await page.locator('.iue-tabs').evaluate(el => getComputedStyle(el).opacity), '0')
      assert.equal(await page.locator('.iue-tabs').evaluate(el => getComputedStyle(el).visibility), 'visible')
      await page.screenshot({ path: `${output}/preferences-${scheme}-390.png`, fullPage: true })
      await page.mouse.click(8, 100)
      await prefs.waitFor({ state: 'hidden' })
      await page.waitForTimeout(350)
      assert.equal(await page.locator('.iue-tabs').evaluate(el => getComputedStyle(el).opacity), '1')
      await startStudy(page)
      await page.locator('#word-wrap').waitFor()
      await page.waitForTimeout(500)
      const example = page.getByRole('button', { name: '查看完整例句', exact: true })
      await example.waitFor()
      assert.equal(await example.evaluate(el => getComputedStyle(el).fontSize), '15px')
      assert.equal(await example.evaluate(el => getComputedStyle(el).webkitLineClamp), '2')
      await skip(page)
      const stage = await page.locator('.word-stage').boundingBox()
      assert.ok(Math.abs(stage.y + stage.height / 2 - (844 + 57) / 2) < 2)
      await page.screenshot({ path: `${output}/learning-${scheme}-390.png`, fullPage: true })
      const progress = await page.getByRole('progressbar', { name: '本组学习进度' }).boundingBox()
      assert.equal(progress.y, 57)
      assert.equal(progress.width, 262)
      const progressBar = page.getByRole('progressbar', { name: '本组学习进度' })
      assert.equal(await progressBar.getAttribute('aria-valuenow'), '1')
      assert.equal(await progressBar.locator('i').evaluate(el => getComputedStyle(el).opacity), '1')
      assert.ok(
        (await progressBar.locator('i').evaluate(el => getComputedStyle(el).transitionTimingFunction)).includes('1.3')
      )
      await page.locator('#word-wrap').click()
      await page.locator('.word-detail-sheet').waitFor()
      await page.waitForTimeout(400)
      await page.screenshot({ path: `${output}/details-${scheme}-390.png`, fullPage: true })
      await page.mouse.click(8, 100)
      await page.locator('.word-detail-sheet').waitFor({ state: 'hidden' })
      await page.getByRole('button', { name: '查看释义详情', exact: true }).click()
      await page.locator('.word-detail-sheet').waitFor()
      await page.waitForTimeout(400)
      const heading = await page.locator('.word-detail-sheet .detail-word-heading').boundingBox()
      await page.mouse.move(heading.x + heading.width / 2, heading.y + 5)
      await page.mouse.down()
      await page.mouse.move(heading.x + heading.width / 2, heading.y + 135, { steps: 8 })
      await page.mouse.up()
      await page.locator('.word-detail-sheet').waitFor({ state: 'hidden' })
      await example.click()
      const detail = page.locator('.word-detail-sheet')
      await detail.waitFor()
      await page.waitForTimeout(400)
      assert.ok((await detail.locator('.word-examples').innerText()).length > 30)
      await page.mouse.click(8, 100)
      await detail.waitFor({ state: 'hidden' })
      await page.getByRole('button', { name: '学习工具', exact: true }).click()
      await page.waitForTimeout(650)
      assert.equal(
        await page.locator('.topic-orb-backdrop').evaluate(el => getComputedStyle(el).backdropFilter),
        'none'
      )
      assert.equal(await page.locator('.practice-shell').evaluate(el => getComputedStyle(el).filter), 'none')
      await page.screenshot({ path: `${output}/tools-${scheme}-390.png`, fullPage: true })
      await page.getByRole('button', { name: '学习工具', exact: true }).click()
      await page.locator('.topic-orb-backdrop').waitFor({ state: 'hidden' })
      await page.waitForTimeout(350)
      for (let n = 0; n < 3; n++) await skip(page)
      assert.equal(await page.locator('.gesture-hint').count(), 0, 'hint appears for first three distinct words only')
      await page.getByRole('link', { name: '保存并返回' }).click()
      await page.locator('.hero-ring-button:enabled').waitFor()
      assert.equal((await data(page)).val.noteData.graphicSentinel, 'keep')
      for (const name of ['打字', '听写', '学习']) {
        await page.getByRole('button', { name, exact: true }).click()
        await page.locator('.hero-ring-button:enabled').waitFor()
        assert.equal(await page.getByRole('button', { name, exact: true }).getAttribute('aria-pressed'), 'true')
      }
      await page.getByRole('button', { name: '错词', exact: true }).click()
      await page.getByText('还没有错词', { exact: true }).waitFor()
      assert.equal(await page.getByText('全部错词', { exact: true }).count(), 0)
      assert.equal(await page.getByRole('button', { name: '巩固错词', exact: true }).count(), 0)
      await page.waitForTimeout(750)
      const empty = await page.locator('.wrong-panel .list-empty').boundingBox()
      assert.ok(Math.abs(empty.y + empty.height / 2 - 844 * 0.42) < 2)
      assert.equal(
        await page.locator('.wrong-panel .list-empty svg path').evaluate(el => getComputedStyle(el).animationName),
        'empty-check-draw'
      )
      await page.screenshot({ path: `${output}/wrong-empty-${scheme}-390.png`, fullPage: true })
      await page.getByRole('button', { name: '复习', exact: true }).click()
      await page.getByRole('button', { name: '开始复习', exact: true }).waitFor()
      assert.deepEqual(errors, [])
      assert.ok((await page.evaluate(() => window.haptics)).every(n => n === 8))
      console.log(
        `PASS: ${scheme} continuous brighter disc arcs, matched floating glass without source glow, word popup examples/audio, modal dock motion, short bright progress, 42% drawn-check empty state, unchanged topic menu and preserved notes`
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

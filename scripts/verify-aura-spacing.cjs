const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const { startStudy, closeWordDetails } = require('./mobile-actions.cjs')
const assert = require('node:assert/strict'),
  fs = require('node:fs')
const base = process.env.IELTS_TEST_URL || 'http://127.0.0.1:4173/ielts/',
  out = process.env.IELTS_SCREENSHOTS || '/tmp/ielts-aura'
fs.mkdirSync(out, { recursive: true })
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
        HTMLMediaElement.prototype.play = function () {
          return this.src.startsWith('https:') ? Promise.reject(new Error('fixture')) : Promise.resolve()
        }
        speechSynthesis.speak = u => queueMicrotask(() => u.onend?.())
        navigator.vibrate = () => true
      })
      const p = await c.newPage(),
        errors = []
      p.on('pageerror', e => errors.push(e.message))
      const shot = name => p.screenshot({ path: `${out}/${name}-${scheme}-390.png`, fullPage: true })
      const mask = el => el.evaluate(e => getComputedStyle(e, '::backdrop').backgroundColor)
      await p.goto(base, { waitUntil: 'networkidle' })
      await p.locator('.hero-ring-button:enabled').waitFor()
      const aura = await p.locator('.hero-ring-button .ring-empty').evaluate(e => {
        const s = getComputedStyle(e, '::after')
        const a = e.getAnimations({ subtree: true }).find(x => x.animationName === 'empty-ring-aura')
        return {
          name: s.animationName,
          duration: s.animationDuration,
          frames: a.effect.getKeyframes().map(x => Number(x.opacity)),
        }
      })
      assert.equal(aura.name, 'empty-ring-aura')
      assert.equal(aura.duration, '12s')
      assert.ok(Math.max(...aura.frames) - Math.min(...aura.frames) <= 0.03001)
      await shot('home-zero')
      await p.locator('.hero-ring-button').click()
      const disc = p.getByRole('dialog', { name: '学习概览', exact: true })
      await disc.waitFor()
      await p.waitForTimeout(450)
      assert.equal(await disc.evaluate(e => getComputedStyle(e).backgroundColor), 'rgba(0, 0, 0, 0)')
      assert.notEqual(await disc.evaluate(e => getComputedStyle(e, '::before').boxShadow), 'none')
      const expectedMask = await mask(disc)
      await shot('disc')
      await p.mouse.click(8, 100)
      await disc.waitFor({ state: 'hidden' })
      await p.getByRole('button', { name: '偏好设置', exact: true }).click()
      const pref = p.getByRole('dialog', { name: '偏好', exact: true })
      await pref.waitFor()
      await p.waitForTimeout(400)
      assert.equal(await mask(pref), expectedMask)
      await shot('preferences')
      await p.mouse.click(8, 100)
      await pref.waitFor({ state: 'hidden' })
      await p.getByRole('button', { name: '环境词表', exact: true }).click()
      const vocab = p.getByRole('dialog', { name: '环境', exact: true })
      await vocab.waitFor()
      await p.waitForTimeout(400)
      assert.equal(await mask(vocab), expectedMask)
      await p.getByRole('button', { name: 'biodiversity', exact: true }).click()
      const vDetail = p.locator('.vocabulary-detail')
      await vDetail.waitFor()
      assert.equal(await mask(vDetail), expectedMask)
      await p.mouse.click(8, 100)
      await vDetail.waitFor({ state: 'hidden' })
      await p.mouse.click(8, 100)
      await vocab.waitFor({ state: 'hidden' })
      await startStudy(p)
      await p.locator('#word-wrap').waitFor()
      await p.waitForTimeout(450)
      const face = await p.locator('.word-swipe-surface').boundingBox(),
        actions = await p.locator('.card-actions').boundingBox()
      assert.ok(Math.abs(actions.y - face.y - face.height - 24) < 1, 'action row follows card at 24px')
      assert.equal(await p.locator('.next-card-echo').count(), 0)
      await shot('learning')
      await p.locator('#word-wrap').click()
      const detail = p.locator('.word-detail-sheet')
      await detail.waitFor()
      await p.waitForTimeout(400)
      assert.equal(await mask(detail), scheme === 'dark' ? 'rgba(0, 0, 0, 0.2)' : 'rgba(25, 30, 40, 0.12)')
      assert.equal(await p.locator('.card-actions').evaluate(e => getComputedStyle(e).visibility), 'hidden')
      await shot('details')
      await closeWordDetails(p)
      await p.getByRole('button', { name: '学习工具', exact: true }).click()
      await p.waitForTimeout(600)
      assert.equal(
        await p.locator('.topic-orb-backdrop').evaluate(e => getComputedStyle(e).backgroundColor),
        expectedMask
      )
      await p.getByRole('button', { name: '学习工具', exact: true }).click()
      await p.locator('.topic-orb-backdrop').waitFor({ state: 'hidden' })
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
        raw.val.word.bookList.find(d => d.id === 'ielts-environment').lastLearnIndex = 6
        await new Promise(resolve => {
          const tx = db.transaction('keyval', 'readwrite')
          tx.objectStore('keyval').put(JSON.stringify(raw), 'typing-word-dict')
          tx.oncomplete = resolve
        })
      })
      await p.reload({ waitUntil: 'networkidle' })
      await p.locator('.hero-ring-button .ring-arc').waitFor()
      const draw = await p
        .locator('.hero-ring-button .ring-arc')
        .first()
        .evaluate(e => {
          const a = e.getAnimations().find(a => a.animationName === 'arc-draw')
          a.pause()
          a.currentTime = 0
          const start = parseFloat(getComputedStyle(e).strokeDashoffset)
          a.currentTime = 900
          const end = parseFloat(getComputedStyle(e).strokeDashoffset)
          return {
            start,
            end,
            target: +e.getAttribute('stroke-dashoffset'),
            ease: getComputedStyle(e).animationTimingFunction,
          }
        })
      assert.ok(draw.start > draw.end + 150)
      assert.ok(Math.abs(draw.end - draw.target) < 0.1)
      assert.ok(draw.ease.includes('1.3'))
      await shot('home-progress')
      await p.getByRole('button', { name: '选择主题', exact: true }).click()
      await p.waitForTimeout(650)
      assert.equal(
        await p.locator('.topic-orb-backdrop').evaluate(e => getComputedStyle(e).backgroundColor),
        expectedMask
      )
      assert.deepEqual(errors, [])
      console.log(
        `PASS ${scheme}: 12s zero aura with opacity span <=3%; true spring zero-to-progress drawing; transparent disc and soft aura; unified masks with stronger word-detail isolation; 24px card-action spacing and no next-card ghost`
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

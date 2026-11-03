const { headerAction, startStudy, closeWordDetails, chooseStudyMode } = require('./mobile-actions.cjs')
/* Run against `pnpm dev` or the generated /ielts/ site.
 * npm install --prefix /tmp/ielts-browser playwright
 * PLAYWRIGHT_MODULE=/tmp/ielts-browser/node_modules/playwright node scripts/verify-mobile.cjs
 * Speech is mocked: this verifies voice requests, not real iPhone audio playback.
 */
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const base = process.env.IELTS_TEST_URL || 'http://127.0.0.1:5567/'
const shots = process.env.IELTS_SCREENSHOTS || '/tmp/ielts-mobile'
fs.mkdirSync(shots, { recursive: true })
let browser
async function context() {
  const ctx = await browser.newContext({
    colorScheme: 'dark',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    acceptDownloads: true,
  })
  await ctx.addInitScript(() => {
    window.testSpeech = []
    window.testHaptics = []
    HTMLMediaElement.prototype.play = function () {
      if (this.id === 'ielts-word-audio' && this.src.startsWith('https:'))
        return Promise.reject(new Error('simulated dictionary failure'))
      return Promise.resolve()
    }
    navigator.vibrate = ms => {
      window.testHaptics.push(ms)
      return true
    }
    speechSynthesis.speak = u => {
      window.testSpeech.push({ text: u.text, lang: u.lang })
      setTimeout(() => u.onend?.(), 0)
    }
  })
  await ctx.route('https://dict.youdao.com/**', route => route.abort())
  const page = await ctx.newPage()
  page.testErrors = []
  page.on('pageerror', error => page.testErrors.push(error.message))
  return { ctx, page }
}
async function home(page) {
  await page.goto(base, { waitUntil: 'networkidle' })
  await page.locator('.hero-ring-button:enabled').waitFor()
}
async function input(page, text) {
  for (const c of text) {
    await page.evaluate(c => {
      const el = document.querySelector('#typing-listener')
      el.value = ' ' + c
      el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: c }))
    }, c)
    await page.waitForTimeout(40)
  }
}
async function backspace(page) {
  await page.evaluate(() => {
    const el = document.querySelector('#typing-listener')
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }))
  })
}
async function word(page) {
  return (await page.locator('#word-wrap').innerText()).replace(/\s/g, '')
}
async function stable(page) {
  await page.locator('#word-wrap').waitFor()
  await page.waitForTimeout(260)
}
async function swipe(page, locator, dx, dy = 0) {
  const box = await locator.boundingBox()
  const x = box.x + (dx < 0 ? box.width * 0.8 : box.width * 0.2),
    y = box.y + Math.min(box.height * 0.5, 260)
  const client = await page.context().newCDPSession(page)
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  for (let i = 1; i <= 8; i++) {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: x + (dx * i) / 8, y: y + (dy * i) / 8 }],
    })
    await page.waitForTimeout(18)
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await client.detach()
  await page.waitForTimeout(650)
}
async function record(page, key, value) {
  return page.evaluate(
    async ({ key, value, write }) => {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open('keyval-store')
        r.onsuccess = () => res(r.result)
        r.onerror = () => rej(r.error)
      })
      if (write)
        return new Promise((res, rej) => {
          const tx = db.transaction('keyval', 'readwrite')
          tx.objectStore('keyval').put(value, key)
          tx.oncomplete = res
          tx.onerror = () => rej(tx.error)
        })
      return new Promise((res, rej) => {
        const r = db.transaction('keyval').objectStore('keyval').get(key)
        r.onsuccess = () => res(r.result)
        r.onerror = () => rej(r.error)
      })
    },
    { key, value, write: arguments.length === 3 }
  )
}
async function uiAndLearning() {
  const { ctx, page } = await context()
  await home(page)
  const style = await page.evaluate(() => ({
    bg: getComputedStyle(document.body).backgroundColor,
    font: getComputedStyle(document.body).fontFamily,
    header: document.querySelector('.app-header').getBoundingClientRect().height,
    width: document.documentElement.scrollWidth,
  }))
  assert.equal(style.bg, 'rgb(0, 0, 0)')
  assert.equal(style.width, 390)
  assert.equal(style.header, 57)
  assert.ok(!style.font.includes('Inter'))
  assert.equal(await page.locator('.unified-dock button').count(), 4)
  await page.screenshot({ path: `${shots}/home.png`, fullPage: true })
  await page.getByRole('button', { name: '错词', exact: true }).click()
  await page.getByText('还没有错词', { exact: true }).waitFor()
  await swipe(page, page.locator('.ielts-home'), -170)
  assert.equal(await page.getByRole('button', { name: '复习', exact: true }).getAttribute('aria-pressed'), 'true')
  await page.getByRole('button', { name: '学习', exact: true }).click()
  await page.getByRole('button', { name: '选择主题', exact: true }).click()
  assert.equal(await page.locator('.avatar-button[aria-label="偏好设置"]').count(), 1)
  assert.equal(await page.locator('.header-actions button[aria-label="偏好设置"]').count(), 0)
  const menu = page.getByRole('menu', { name: '主题', exact: true })
  await menu.waitFor()
  await page.waitForTimeout(850)
  const orbs = menu.getByRole('menuitemradio')
  assert.equal(await orbs.count(), 6)
  assert.equal(await page.getByRole('dialog', { name: '主题', exact: true }).count(), 0)
  const sizes = await orbs.evaluateAll(nodes =>
    nodes.map(node => ({
      width: node.getBoundingClientRect().width,
      height: node.getBoundingClientRect().height,
      delay: getComputedStyle(node).transitionDelay,
    }))
  )
  assert.ok(sizes.every(s => Math.abs(s.width - 38) < 0.1 && Math.abs(s.height - 38) < 0.1))
  assert.equal(sizes[1].delay, '0.03s')
  assert.equal(sizes[5].delay, '0.15s')
  assert.equal(
    await menu.getByRole('menuitemradio', { name: '环境', exact: true }).getAttribute('aria-checked'),
    'true'
  )
  await page.screenshot({ path: `${shots}/topics.png`, fullPage: true })
  await page.getByRole('button', { name: '选择主题', exact: true }).click()
  await menu.waitFor({ state: 'hidden' })
  await page.waitForTimeout(300)
  await startStudy(page)
  await page.waitForURL('**/practice-words/**')
  await stable(page)
  const first = await word(page)
  await headerAction(page, '打开键盘')
  await input(page, first.slice(0, 2))
  await input(page, 'x')
  assert.equal(
    await page
      .locator('.typing-core .wrong')
      .last()
      .evaluate(el => getComputedStyle(el).color),
    'rgb(233, 170, 170)'
  )
  await backspace(page)
  await input(page, first.slice(2))
  await page.waitForTimeout(650)
  const second = await word(page)
  assert.notEqual(second, first, 'correct answer advances automatically')
  await page.locator('#word-wrap').click()
  await closeWordDetails(page)
  await page.locator('#word-wrap').click()
  await closeWordDetails(page)
  const target = await page.locator('#word-wrap').boundingBox()
  await page.mouse.move(target.x + target.width / 2, target.y + 10)
  await page.mouse.down()
  await page.waitForTimeout(480)
  await page.mouse.up()
  assert.equal(await page.evaluate(() => window.testSpeech.at(-1)?.text), second)
  await swipe(page, page.locator('#word-wrap'), -170)
  const third = await word(page)
  assert.notEqual(third, second, 'left swipe skips')
  await page.getByRole('button', { name: '单词详情', exact: true }).click()
  await page.getByRole('button', { name: '笔记', exact: true }).click()
  await page.getByRole('textbox', { name: '单词笔记' }).fill('雅思备考笔记')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await page.keyboard.press('Escape')
  await page.waitForTimeout(430)
  await page.getByRole('link', { name: '保存并返回' }).click()
  await page.getByRole('button', { name: '继续学习', exact: true }).waitFor()
  await page.getByRole('button', { name: '选择主题', exact: true }).click()
  await menu.waitFor()
  assert.equal(await menu.getByRole('menuitemradio').count(), 6)
  await page.getByRole('button', { name: '选择主题', exact: true }).click()
  await menu.waitFor({ state: 'hidden' })
  await chooseStudyMode(page, '听写')
  await page.locator('.hero-ring-button:enabled').waitFor()
  await startStudy(page)
  await page.waitForURL('**/practice-words/**')
  await stable(page)
  await page.getByRole('button', { name: '播放发音', exact: true }).click()
  const listening = await page.evaluate(() => window.testSpeech.at(-1).text)
  await input(page, listening)
  await page.waitForTimeout(650)
  assert.notEqual(
    await page.evaluate(() => window.testSpeech.at(-1).text),
    listening,
    'listening advances automatically'
  )
  await page.getByRole('link', { name: '保存并返回' }).click()
  await page.locator('.hero-ring-button:enabled').waitFor()
  await chooseStudyMode(page, '学习')
  await startStudy(page)
  await page.waitForURL('**/practice-words/**')
  await stable(page)
  assert.equal(await word(page), third, 'System mode 0 session is restored')
  assert.equal(await page.locator('.practice-dock, .practice-controls').count(), 0)
  await page.waitForTimeout(4700)
  await page.screenshot({ path: `${shots}/practice.png`, fullPage: true })
  await page.getByRole('link', { name: '保存并返回' }).click()
  await page.locator('.hero-ring-button:enabled').waitFor()
  await headerAction(page, '偏好设置')
  const preferences = page.getByRole('dialog', { name: '偏好', exact: true })
  assert.equal(await preferences.getByRole('slider', { name: '每日新词' }).count(), 1)
  assert.equal(await preferences.getByRole('switch', { name: '自动发音' }).count(), 1)
  assert.equal(await preferences.getByRole('button', { name: '关闭', exact: true }).count(), 0)
  assert.ok(!/导出备份|添加到主屏幕|关于|英式/.test(await preferences.innerText()))
  await page.screenshot({ path: `${shots}/preferences.png`, fullPage: true })
  assert.deepEqual(page.testErrors, [])
  assert.ok((await page.evaluate(() => window.testHaptics)).every(n => n === 8))
  await ctx.close()
  console.log(
    'PASS: monochrome layout, tabs/swipe, orb geometry/toggle, automatic typing/listening, long press, skip, note, mode-0 resume, two-item preferences'
  )
}
async function legacyAndReview() {
  const { ctx, page } = await context()
  await home(page)
  const saved = JSON.parse(await record(page, 'typing-word-dict'))
  const topic = saved.val.word.bookList.find(d => d.id === 'ielts-environment')
  topic.lastLearnIndex = 7
  const words = await page.evaluate(
    async base => await (await fetch(new URL('dicts/en/word/ielts-environment.json', base))).json(),
    base
  )
  saved.val.word.bookList.push({
    ...topic,
    id: 1,
    enName: 'cet4',
    name: 'CET-4',
    url: 'CET4_T.json',
    length: 2607,
    lastLearnIndex: 137,
    statistics: [{ startDate: 1700000000000, total: 20, new: 20, review: 0, wrong: 1, spend: 120000 }],
  })
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
  saved.val.noteData.legacy = '保留已有笔记'
  saved.val.word.bookList.find(d => d.id === 'wordWrong').words = words.slice(0, 2)
  saved.val.word.bookList.find(d => d.id === 'wordWrong').length = 2
  await record(page, 'typing-word-dict', JSON.stringify(saved))
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('.hero-ring-button:enabled').waitFor()
  let after = JSON.parse(await record(page, 'typing-word-dict'))
  assert.equal(after.val.word.bookList.find(d => d.id === 1).lastLearnIndex, 137)
  assert.deepEqual(after.val.fsrsData.biodiversity, saved.val.fsrsData.biodiversity)
  assert.equal(after.val.noteData.legacy, '保留已有笔记')
  await startStudy(page)
  await page.waitForURL('**/practice-words/**')
  await stable(page)
  const first = await word(page)
  await input(page, first)
  await page.waitForTimeout(650)
  const next = await word(page)
  await page.getByRole('link', { name: '保存并返回' }).click()
  await page.locator('.hero-ring-button:enabled').waitFor()
  await page.getByRole('button', { name: '复习', exact: true }).click()
  await page.getByRole('button', { name: '开始复习', exact: true }).waitFor()
  assert.ok((await page.locator('.word-list-panel').innerText()).includes('biodiversity'))
  await page.getByRole('button', { name: '开始复习', exact: true }).click()
  await page.waitForURL('**/practice-words/**')
  await stable(page)
  assert.equal(
    await page.locator('.typing-word').getAttribute('data-practice-phase'),
    '回想',
    'review starts its own flow, not unfinished new words'
  )
  await page.getByRole('link', { name: '保存并返回' }).click()
  await page.getByRole('button', { name: '学习', exact: true }).click()
  await startStudy(page)
  await page.waitForURL('**/practice-words/**')
  await stable(page)
  assert.equal(await word(page), next, 'review preserves unfinished new-word session')
  await page.getByRole('link', { name: '保存并返回' }).click()
  await page.getByRole('button', { name: '错词', exact: true }).click()
  await page.locator('.word-row').first().waitFor()
  await swipe(page, page.locator('.word-list-panel .word-row-wrap').first(), -150)
  assert.equal(await page.locator('.word-list-panel .word-row').count(), 1)
  await page.screenshot({ path: `${shots}/wrong.png`, fullPage: true })
  await page.getByRole('button', { name: '巩固错词', exact: true }).click()
  await page.waitForURL('**/practice-words/wordWrong')
  await stable(page)
  await page.reload({ waitUntil: 'networkidle' })
  await stable(page)
  assert.ok(await page.locator('#word-wrap').count(), 'system wrong-word dictionary supports direct reload')
  assert.deepEqual(page.testErrors, [])
  await ctx.close()
  console.log('PASS: legacy progress/FSRS/notes, separate review session, wrong-word swipe removal and reload')
}
async function completeCycle() {
  const { ctx, page } = await context()
  await home(page)
  const saved = JSON.parse(await record(page, 'typing-word-dict'))
  saved.val.word.bookList.find(d => d.id === 'ielts-environment').perDayStudyNumber = 5
  await record(page, 'typing-word-dict', JSON.stringify(saved))
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('.hero-ring-button:enabled').waitFor()
  await startStudy(page)
  await page.waitForURL('**/practice-words/**')
  await stable(page)
  const phases = new Set()
  let complete = false
  let lastDailyProgress = 0
  for (let i = 0; i < 80; i++) {
    const done = page.getByRole('dialog', { name: '这一组，记住了。', exact: true })
    if (await done.isVisible()) {
      complete = true
      break
    }
    const dailyProgress = Number(await page.locator('.practice-mini-progress').getAttribute('aria-valuenow'))
    assert.ok(dailyProgress >= lastDailyProgress, 'repeated phases must not reset daily progress')
    assert.ok(dailyProgress <= 5, 'repeated phases must not double-count new words')
    lastDailyProgress = dailyProgress
    const phase = await page.locator('.typing-word').getAttribute('data-practice-phase')
    phases.add(phase)
    if (phase === '回想') await page.getByRole('button', { name: '认识', exact: true }).click()
    else {
      await page.getByRole('button', { name: '播放发音', exact: true }).click()
      const current = await page.evaluate(() => window.testSpeech.at(-1).text)
      await input(page, current)
    }
    await page.waitForTimeout(650)
  }
  assert.ok(complete, 'full learning cycle completes without a Next button')
  assert.equal(lastDailyProgress, 5)
  await page.getByRole('button', { name: '再学一组 →', exact: true }).click()
  await stable(page)
  assert.equal(await word(page), 'ecosystem', 'completed progress advances exactly once')
  await page.getByRole('link', { name: '保存并返回' }).click()
  await page.locator('.hero-ring-button:enabled').waitFor()
  const data = JSON.parse(await record(page, 'typing-word-dict')).val
  assert.equal(data.word.bookList.find(d => d.id === 'ielts-environment').lastLearnIndex, 5)
  assert.equal(Object.keys(data.fsrsData).length, 5)
  await page.locator('.hero-ring-button .ring-arc').waitFor()
  const todayRatio = await page
    .locator('.hero-ring-button .ring-arc')
    .evaluate(e => 1 - Number(e.getAttribute('stroke-dashoffset')) / (2 * Math.PI * 110))
  assert.ok(todayRatio > 0, 'a completed learning cycle grows the real daily arc')
  assert.ok(Object.values(data.fsrsData).every(card => card.due))
  assert.deepEqual(page.testErrors, [])
  await ctx.close()
  console.log(
    'PASS: full automatic cycle, five FSRS review cards, correct next-group progress; phases:',
    [...phases].join(', ')
  )
}
;(async () => {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_BIN || '/usr/bin/chromium',
    args: ['--no-sandbox'],
  })
  try {
    await uiAndLearning()
    await legacyAndReview()
    await completeCycle()
  } finally {
    await browser.close()
  }
})().catch(error => {
  console.error(error)
  process.exitCode = 1
})

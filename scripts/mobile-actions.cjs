// Header actions remain reachable from the compact study menu and from the home avatar.
async function headerAction(page, name) {
  const button = page.getByRole('button', { name, exact: true })
  if (await button.isVisible()) return button.click()
  const item = page.getByRole('menuitem', { name, exact: true })
  if (!(await item.isVisible())) await page.getByRole('button', { name: '学习工具', exact: true }).click()
  await item.click()
}
async function startStudy(page) {
  await page.locator('.hero-ring-button:enabled').click()
  const overview = page.getByRole('dialog', { name: '学习概览', exact: true })
  await overview.waitFor()
  await overview.locator('.overview-start').click()
  await page.waitForURL('**/practice-words/**')
}
async function closeWordDetails(page) {
  const detail = page.locator('.word-detail-sheet')
  if (await detail.isVisible()) {
    await page.mouse.click(8, 100)
    await detail.waitFor({ state: 'hidden' })
    await page.waitForTimeout(230)
  }
}
module.exports = { headerAction, startStudy, closeWordDetails }

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
module.exports = { headerAction, startStudy }

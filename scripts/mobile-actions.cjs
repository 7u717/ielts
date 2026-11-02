// Header actions remain reachable from the compact study menu and from the home avatar.
async function headerAction(page, name) {
  const button = page.getByRole('button', { name, exact: true })
  if (await button.isVisible()) return button.click()
  const item = page.getByRole('menuitem', { name, exact: true })
  if (!(await item.isVisible())) await page.getByRole('button', { name: '学习工具', exact: true }).click()
  await item.click()
}
module.exports = { headerAction }

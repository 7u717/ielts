export default defineNuxtPlugin(() => {
  const viewport = window.visualViewport
  if (!viewport) return
  const update = () => {
    const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
    document.documentElement.style.setProperty('--keyboard-inset', `${inset}px`)
    document.documentElement.dataset.keyboardOpen = String(inset > 100)
  }
  viewport.addEventListener('resize', update)
  viewport.addEventListener('scroll', update)
  update()
})

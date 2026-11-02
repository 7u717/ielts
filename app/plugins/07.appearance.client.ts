// Appearance follows the device without rewriting any saved preference or progress.
export default defineNuxtPlugin(nuxtApp => {
  const query = window.matchMedia('(prefers-color-scheme: light)')
  const apply = () => {
    const mode = query.matches ? 'light' : 'dark'
    document.documentElement.classList.remove('light', 'dark')
    document.documentElement.classList.add(mode)
    document.documentElement.dataset.appearance = mode
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', mode === 'light' ? '#f6f7f9' : '#000000')
  }
  apply()
  query.addEventListener('change', apply)
  nuxtApp.vueApp.onUnmount(() => query.removeEventListener('change', apply))
})

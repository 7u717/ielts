// Cache only this app's public resources; learning records stay in IndexedDB.
const CACHE = 'ielts-shell-v1'
const base = new URL('./', self.location.href)
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll([
    base.href, new URL('manifest.json', base).href,
    new URL('icons/icon-192.png', base).href,
  ])))
})
self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('ielts-shell-') && k !== CACHE).map(k => caches.delete(k)))),
    self.clients.claim(),
  ]))
})
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) {
      const copy = response.clone()
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy)))
    }
    return response
  }).catch(async () => (await caches.match(event.request)) || Response.error()))
})

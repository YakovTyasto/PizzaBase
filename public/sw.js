/*
 * Impasto service worker.
 *
 * Deliberately small and hand-written: the caching rules here are specific to
 * how the app is used in a kitchen, and a generic plugin would not express
 * them. Three strategies, chosen per request type:
 *
 *   - App shell and static assets: cache-first, since they change only on
 *     deploy and a cook should not wait on the network for chrome.
 *   - Navigations and data: network-first with a cache fallback, so a recipe
 *     you opened yesterday still opens in a kitchen with no signal.
 *   - Everything else: straight to the network.
 *
 * Writes are never queued here. The first release is explicit about this:
 * saved recipes are readable offline and cooking progress lives in local
 * storage, but mutations require a connection. A half-working sync queue would
 * be worse than an honest limitation.
 */

const VERSION = 'v1'
const SHELL_CACHE = `impasto-shell-${VERSION}`
const PAGE_CACHE = `impasto-pages-${VERSION}`
const ASSET_CACHE = `impasto-assets-${VERSION}`

const SHELL_ASSETS = ['/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      // A missing optional asset must not abort the whole installation.
      .then((cache) => Promise.allSettled(SHELL_ASSETS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  const keep = new Set([SHELL_CACHE, PAGE_CACHE, ASSET_CACHE])
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !keep.has(key)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  )
})

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(?:css|js|woff2?|png|jpg|jpeg|svg|webp|avif)$/.test(url.pathname)
  )
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached

  const response = await fetch(request)
  if (response.ok) cache.put(request, response.clone())
  return response
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    // Only successful, same-origin, basic responses are worth keeping.
    if (response.ok && response.type === 'basic') cache.put(request, response.clone())
    return response
  } catch (error) {
    const cached = await cache.match(request)
    if (cached) return cached
    if (request.mode === 'navigate') {
      const offline = await cache.match('/offline')
      if (offline) return offline
    }
    throw error
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Never interfere with mutations; they must fail loudly when offline.
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Auth callbacks and API writes must always hit the network.
  if (url.pathname.startsWith('/api/')) return

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request, ASSET_CACHE))
    return
  }

  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirst(request, PAGE_CACHE))
  }
})

/** Lets the app ask for a recipe to be kept for offline reading. */
self.addEventListener('message', (event) => {
  const data = event.data
  if (!data || data.type !== 'cache-urls' || !Array.isArray(data.urls)) return
  event.waitUntil(
    caches
      .open(PAGE_CACHE)
      .then((cache) => Promise.allSettled(data.urls.map((url) => cache.add(url)))),
  )
})

const CACHE_NAME = "cashtrack-cache-v1"
const STATIC_ASSETS = ["/", "/manifest.json"]

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME)
  const cached = await cache.match(request)
  if (cached) {
    return cached
  }
  const response = await fetch(request)
  cache.put(request, response.clone())
  return response
}

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME)
  try {
    const response = await fetch(request)
    cache.put(request, response.clone())
    return response
  } catch (error) {
    const cached = await cache.match(request)
    if (cached) {
      return cached
    }
    throw error
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event
  if (request.method !== "GET") {
    return
  }

  const url = new URL(request.url)

  if (url.origin === self.location.origin && url.pathname.startsWith("/_next/")) {
    event.respondWith(cacheFirst(request))
    return
  }

  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request))
    return
  }

  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request))
  }
})

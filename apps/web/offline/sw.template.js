/* SimLoad service worker (generated at build time): keeps the app usable offline. */
const VERSION = '__SIMLOAD_VERSION__';
const PRECACHE = __SIMLOAD_PRECACHE__;
const CACHE = `simload-${VERSION}`;
const PREFIX = 'simload-';
const SCOPE = self.registration.scope;
/** The app shell: what every navigation inside the scope receives. */
const SHELL = new URL('./', SCOPE).href;
/** Give up on a slow network for page loads and serve the cached shell. */
const NAVIGATION_TIMEOUT_MS = 4000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE.map((path) => new URL(path, SCOPE).href)))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Network first, so an online visit always gets the latest deploy; cache when offline. */
async function navigate(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), NAVIGATION_TIMEOUT_MS),
      ),
    ]);
    if (response.ok) await cache.put(SHELL, response.clone());
    return response;
  } catch {
    const cached = await cache.match(SHELL, { ignoreSearch: true });
    return cached ?? Response.error();
  }
}

/** Cache first: built files have content hashes in their names, so they never go stale. */
async function asset(request) {
  const cached = await caches.match(request, { ignoreSearch: true });
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === 'basic') {
    const cache = await caches.open(CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || !request.url.startsWith(SCOPE)) return;
  event.respondWith(request.mode === 'navigate' ? navigate(request) : asset(request));
});

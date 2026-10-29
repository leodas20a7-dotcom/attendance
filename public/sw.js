// Convenio Marts Smart Service Worker - Immediate Update Architecture
const CACHE_NAME = 'convenio-cache-v1';

// Install: Immediately activate without waiting for old worker to terminate
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activate: Immediately claim all open client tabs and purge stale caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Strategy:
// 1. Navigation / HTML -> Network-FIRST (always get freshest deploy; fallback to cache if offline)
// 2. Supabase API / External -> Network-ONLY (never cache live DB attendance records)
// 3. Static hashed assets -> Cache-first with network fallback
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests and Supabase / API requests
  if (request.method !== 'GET' || url.origin.includes('supabase.co')) {
    return;
  }

  // Navigation requests (HTML): Always try network first to ensure instant deploy updates
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request).then((res) => res || caches.match('/index.html')))
    );
    return;
  }

  // Version or manifest check: Always network first so client detects build updates immediately
  if (url.pathname.endsWith('manifest.json') || url.pathname.endsWith('version.json')) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  // Static Assets (Hashed JS/CSS/Fonts/Icons)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to update cache for next time (Stale-While-Revalidate)
        fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
          }
        }).catch(() => {/* Offline, ignore */});
        return cachedResponse;
      }

      return fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return networkResponse;
      });
    })
  );
});

// Listen for skip waiting messages from the React app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

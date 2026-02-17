const CACHE_NAME = 'clawdbot-v2';
const SHARED_CACHE = 'clawdbot-shared';

// Precache the app shell on install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(['/', '/icon-192.svg', '/icon-512.svg', '/manifest.json'])
    )
  );
  self.skipWaiting();
});

// Clean old caches and claim clients on activate
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== SHARED_CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Handle Share Target: intercept the POST, stash the audio, redirect to app
  if (url.pathname === '/share-target' && event.request.method === 'POST') {
    event.respondWith(
      (async () => {
        const formData = await event.request.formData();
        const audioFile = formData.get('audio');

        if (audioFile) {
          // Store the shared audio file in a dedicated cache
          const cache = await caches.open(SHARED_CACHE);
          await cache.put('/shared-audio-file', new Response(audioFile, {
            headers: { 'Content-Type': audioFile.type || 'audio/mpeg' },
          }));
        }

        // Redirect to the main page with a flag
        return Response.redirect('/?shared=audio', 303);
      })()
    );
    return;
  }

  // Skip non-GET and API requests
  if (event.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return;

  // Network-first strategy for everything else
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

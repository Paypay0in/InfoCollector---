self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  // Just a passthrough to satisfy PWA criteria
  event.respondWith(fetch(event.request));
});

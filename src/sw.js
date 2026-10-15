const CACHE = 'gaji-survival-__BUILD__';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('gaji-survival-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  const shellURLs = SHELL.map(path => new URL(path, self.registration.scope).href);
  if (!shellURLs.includes(event.request.url)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(event.request);
      if (!response.ok) throw new Error('Network response unavailable');
      try { await cache.put(event.request, response.clone()); } catch { /* Network responses remain usable when cache storage is full. */ }
      return response;
    } catch {
      const cached = await cache.match(event.request);
      return cached || (event.request.mode === 'navigate' ? await cache.match('./index.html') : Response.error());
    }
  })());
});

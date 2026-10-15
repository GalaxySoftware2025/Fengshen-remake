// The service worker of the public build: the files the extractor made from the player's ROM (Cache Storage,
// 'fengshen-rom') are served where the game asks for them (assets/, data/); anything else goes to the network.
const CACHE = 'fengshen-rom';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin || !/\/(assets|data)\//.test(url.pathname)) return;
  e.respondWith(caches.open(CACHE).then(c => c.match(url.origin + url.pathname)).then(r => r || fetch(e.request)));
});

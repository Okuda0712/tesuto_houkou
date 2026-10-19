const CACHE_NAME = 'kamakura-disaster-cache-v38';
const TILE_CACHE_NAME = 'kamakura-disaster-tile-cache-v14';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './app.js',
  './style.css?v=35',
  './leaflet.js',
  './leaflet.css',
  './manifest.json',
  './icon.svg',
  './images/layers.png',
  './images/layers-2x.png',
  './images/marker-icon.png',
  './images/marker-icon-2x.png',
  './images/marker-shadow.png'
];

const TILE_HOSTS = [
  'tile.openstreetmap.org',
  'a.tile.openstreetmap.org',
  'b.tile.openstreetmap.org',
  'c.tile.openstreetmap.org',
  'disaportaldata.gsi.go.jp'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME && cache !== TILE_CACHE_NAME) {
            return caches.delete(cache);
          }
          return Promise.resolve();
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  const isLocal = requestUrl.origin === location.origin;
  const isTile = TILE_HOSTS.includes(requestUrl.hostname);

  if (isLocal && event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        return caches.match('./index.html');
      })
    );
    return;
  }

  if (isLocal) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request);
      })
    );
    return;
  }

  if (isTile) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          const copy = networkResponse.clone();
          caches.open(TILE_CACHE_NAME).then((cache) => {
            cache.put(event.request, copy);
          });
          return networkResponse;
        });
      })
    );
  }
});

/* Service Worker — Fases da Lua (v9) */
const CACHE = 'fases-da-lua-v9';
const PRECACHE = ['./', './index.html', './app.js', './manifest.json',
  './icon.svg', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return Promise.allSettled(PRECACHE.map(function (u) { return c.add(u); })); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (ks) {
        return Promise.all(ks.filter(function (k) { return k !== CACHE; })
          .map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* APIs de clima/cidade: rede primeiro, cache só offline */
  const ehApi = ['open-meteo', 'bigdatacloud', 'nominatim'].some(function (h) { return url.hostname.includes(h); });
  if (ehApi) {
    e.respondWith(
      fetch(req).then(function (resp) {
        const cp = resp.clone();
        caches.open(CACHE).then(function (c) { c.put(req, cp); });
        return resp;
      }).catch(function () { return caches.match(req); })
    );
    return;
  }

  /* Ícones: cache primeiro (nunca mudam) */
  if (url.pathname.includes('icon')) {
    e.respondWith(
      caches.match(req).then(function (c) {
        return c || fetch(req).then(function (resp) {
          const cp = resp.clone();
          caches.open(CACHE).then(function (x) { x.put(req, cp); });
          return resp;
        });
      })
    );
    return;
  }

  /* HTML, JS, manifest: REDE primeiro — garante versão nova — cache no offline */
  e.respondWith(
    fetch(req).then(function (resp) {
      if (resp.ok) {
        const cp = resp.clone();
        caches.open(CACHE).then(function (c) { c.put(req, cp); });
      }
      return resp;
    }).catch(function () {
      return caches.match(req).then(function (c) { return c || caches.match('./index.html'); });
    })
  );
});

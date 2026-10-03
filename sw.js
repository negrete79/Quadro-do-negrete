/* Service Worker — Fases da Lua (v15) */
const CACHE = 'fases-da-lua-v15';
const PRECACHE = ['./', './index.html', './manifest.json',
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

  /* APIs de clima/cidade: rede primeiro, cache para offline */
  const ehApi = ['open-meteo', 'bigdatacloud', 'nominatim'].some(function (h) { return url.hostname.includes(h); });
  if (ehApi) {
    e.respondWith(
      fetch(req).then(function (resp) {
        if (resp && resp.ok) {
          const cp = resp.clone();
          caches.open(CACHE).then(function (c) { c.put(req, cp); });
        }
        return resp;
      }).catch(function () { return caches.match(req); })
    );
    return;
  }

  /* Ícones: cache primeiro (nunca mudam) */
  if (url.pathname.includes('icon')) {
    e.respondWith(
      caches.match(req, { ignoreSearch: true }).then(function (c) { return c || fetch(req); })
    );
    return;
  }

  /* HTML/manifest: rede primeiro (versão sempre nova), cache no offline */
  e.respondWith(
    fetch(req).then(function (resp) {
      if (resp && resp.ok) {
        const cp = resp.clone();
        caches.open(CACHE).then(function (c) { c.put(req, cp); });
        return resp;
      }
      return caches.match(req, { ignoreSearch: true })
        .then(function (c) { return c || resp; });
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true })
        .then(function (c) { return c || caches.match('./index.html', { ignoreSearch: true }); });
    })
  );
});

/* Service Worker — Fases da Lua */
const CACHE = 'fases-da-lua-v1';
const PRECACHE = ['./', './index.html', './app.js', './manifest.json',
  './icon.svg', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(PRECACHE.map(u => c.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // APIs de clima/cidade: rede primeiro, guarda cópia para offline
  if (url.hostname.includes('open-meteo') || url.hostname.includes('bigdatacloud')) {
    e.respondWith(
      fetch(req).then(resp => {
        const cp = resp.clone();
        caches.open(CACHE).then(c => c.put(req, cp));
        return resp;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Navegação: offline → index.html
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('./index.html')));
    return;
  }

  // Demais arquivos: cache primeiro
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(resp => {
      if (resp.ok) {
        const cp = resp.clone();
        caches.open(CACHE).then(c => c.put(req, cp));
      }
      return resp;
    }).catch(() => cached))
  );
});

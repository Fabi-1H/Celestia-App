const CACHE_NAME = 'celestia-cache-v1';

const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './launchericon-192x192.png',
  './launchericon-512x512.png',
  'https://fonts.googleapis.com/css2?family=Pinyon+Script&family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/jsmediatags/3.9.5/jsmediatags.min.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all(PRECACHE_URLS.map((url) => {
        const req = new Request(url, { mode: url.startsWith('http') ? 'no-cors' : 'same-origin' });
        return fetch(req)
          .then((response) => cache.put(url, response))
          .catch(() => {}); // si falla algo (ej. sin internet la primera vez), seguimos igual
      }));
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
    ))
  );
  self.clients.claim();
});

// Estrategia: mostrar la copia guardada al instante si existe, y de paso
// actualizarla en segundo plano si hay internet. Si no hay red y tampoco
// copia guardada, ahí sí falla (no debería pasar tras la primera visita).
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((resp) => {
        if (resp && (resp.status === 200 || resp.type === 'opaque')) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return resp;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

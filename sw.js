const CACHE_NAME = 'celestia-cache-v2';

// Archivos propios de la app (se guardan al instalar)
const PRECACHE_URLS = [
  './',
  './index.html',
  './manifest.json',
  './launchericon-192x192.png',
  './launchericon-512x512.png'
];

// Librerías y tipografías externas: se guardan la primera vez que se usan
const STATIC_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(PRECACHE_URLS.map((url) =>
        fetch(url, { cache: 'reload' }).then((r) => { if (r && r.ok) return cache.put(url, r); }).catch(() => {})
      ))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== IMG_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(req, timeoutMs) {
  return new Promise((resolve) => {
    let done = false;
    const fallback = () => caches.match(req, { ignoreSearch: true }).then((c) => { if (!done) { done = true; resolve(c || Response.error()); } });
    const timer = setTimeout(fallback, timeoutMs);
    fetch(req, { cache: 'no-cache' }).then((resp) => {
      clearTimeout(timer);
      if (resp && resp.ok) {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
      }
      if (!done) { done = true; resolve(resp); }
    }).catch(() => { clearTimeout(timer); fallback(); });
  });
}

const IMG_CACHE = 'celestia-img-v1';
const IMG_MAX = 400;

function trimImages(cache) {
  return cache.keys().then((keys) => {
    const extra = keys.length - IMG_MAX;
    return Promise.all(keys.slice(0, Math.max(0, extra)).map((k) => cache.delete(k)));
  });
}

function imageCache(req) {
  return caches.open(IMG_CACHE).then((cache) => cache.match(req.url).then((cached) => {
    if (cached) return cached;
    // se pide con permiso CORS para poder guardarla con tamaño real (no "opaca")
    return fetch(req.url, { mode: 'cors', credentials: 'omit' }).then((resp) => {
      if (resp && resp.ok) {
        cache.put(req.url, resp.clone()).then(() => trimImages(cache));
        return resp;
      }
      return fetch(req);
    }).catch(() => fetch(req));
  }));
}

function cacheFirst(req) {
  return caches.match(req).then((cached) => cached || fetch(req).then((resp) => {
    if (resp && (resp.ok || resp.type === 'opaque')) {
      const copy = resp.clone();
      caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
    }
    return resp;
  }));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Archivos propios: primero la versión de internet (así las actualizaciones se ven al instante);
  // si no hay red o tarda más de 4 s, se usa la copia guardada.
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(req, 4000));
    return;
  }
  // Fuentes y librerías: copia guardada primero (no cambian)
  if (STATIC_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(req));
    return;
  }
  // Imágenes de otros sitios (artistas, portadas): se guardan para verlas sin conexión
  if (req.destination === 'image') {
    event.respondWith(imageCache(req));
    return;
  }
  // Todo lo demás (letras, datos de Wikipedia...): no se toca; la app ya guarda lo que necesita
});

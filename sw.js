const CACHE = 'gestao-imoveis-v1';
const ASSETS = ['./','./index.html','./manifest.webmanifest','./css/app.css','./js/app.js','./js/pwa.js',
  './vendor/chart.umd.js','./vendor/fontawesome/css/all.min.css',
  './vendor/fontawesome/webfonts/fa-solid-900.woff2','./vendor/fontawesome/webfonts/fa-regular-400.woff2','./vendor/fontawesome/webfonts/fa-brands-400.woff2',
  './fonts/inter-latin-wght-normal.woff2','./icons/icon-192.png','./icons/icon-512.png','./icons/icon-maskable-512.png','./icons/apple-touch-icon.png','./icons/favicon-32.png'];

self.addEventListener('install', e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())));

// Abre do cache (funciona offline) e atualiza o cache em segundo plano
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });
    const rede = fetch(req, { cache: 'no-cache' }).then(r => { if (r && r.ok) cache.put(req, r.clone()); return r; }).catch(() => null);
    if (cached) { e.waitUntil(rede); return cached; }
    const r = await rede;
    if (r) return r;
    return req.mode === 'navigate' ? cache.match('./index.html') : new Response('', { status: 504 });
  })());
});

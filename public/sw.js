// Service worker: opens the app instantly and lets you review notes offline.
// App files: serve the cached copy at once, refresh it in the background.
// Pictures (/api/image): cached once seen, so they still show with no signal.
// Everything else under /api is never cached.
const APP = 'nb-app-v2';
const IMG = 'nb-img';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'md.js', 'merge.js', 'manifest.webmanifest', 'icon.svg', 'icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(APP).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== APP && k !== IMG && k.startsWith('nb-')).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.origin === location.origin && url.pathname === '/api/image') {
    e.respondWith(caches.open(IMG).then(async (c) => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }
  if (url.origin === location.origin && url.pathname.startsWith('/api/')) return;

  // fonts from Google: cache after first use
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(APP).then(async (c) => {
      const hit = await c.match(req);
      const net = fetch(req).then((res) => { if (res.ok || res.type === 'opaque') c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }

  if (url.origin === location.origin) {
    e.respondWith(caches.open(APP).then(async (c) => {
      const hit = await c.match(req, { ignoreSearch: true });
      const net = fetch(req).then((res) => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
      return hit || net;
    }));
  }
});

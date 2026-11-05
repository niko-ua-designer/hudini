// Hudini panel as an installable app. Network first, so updates arrive at once;
// the cached copy is only used when the network is down. Requests to other sites (Hudini Host, Twitch, YouTube) are not touched.
const CACHE = 'hudini-v2';
const SHELL = ['moderator.html', 'moderator.js', 'ui.js', 'ui.css', 'core.js', 'core.css', 'presets/animations.js', 'i18n.js', 'icons.js', 'manifest.webmanifest', 'icons/icon-192.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if(req.method !== 'GET' || url.origin !== location.origin || url.pathname.endsWith('/version.json')) return;
  e.respondWith((async () => {
    try{
      const res = await fetch(req);
      if(res.ok){ const c = await caches.open(CACHE); c.put(req, res.clone()).catch(() => {}); }
      return res;
    }catch(err){
      const hit = await caches.match(req, { ignoreSearch:true });
      if(hit) return hit;
      throw err;
    }
  })());
});

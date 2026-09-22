const CACHE_NAME='kenichi-v35';
const STATIC_FILES=['/','/index.html','/style.css','/initial_books.json','/manifest.webmanifest','/icon-180.png','/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(STATIC_FILES)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))));self.clients.claim()});
self.addEventListener('fetch',e=>{const r=e.request,u=new URL(r.url);if(u.pathname==='/app.js'){e.respondWith(fetch(r,{cache:'no-store'}).catch(()=>caches.match(r)));return}if(r.mode==='navigate'||u.pathname==='/'||u.pathname==='/index.html'){e.respondWith(fetch(r,{cache:'no-store'}).catch(()=>caches.match('/index.html')));return}e.respondWith(caches.match(r).then(c=>c||fetch(r)))});

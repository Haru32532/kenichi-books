const CACHE_NAME = "kenichi-v10";

const STATIC_FILES = [
  "/",
  "/index.html",
  "/style.css",
  "/initial_books.json",
  "/manifest.webmanifest",
  "/icon-180.png",
  "/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_FILES))
  );

  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  // app.js は必ずネットワークの最新版を優先
  if (url.pathname === "/app.js") {
    event.respondWith(
      fetch(request, { cache: "no-store" }).catch(() =>
        caches.match(request)
      )
    );
    return;
  }

  // HTMLもネットワークを優先
  if (
    request.mode === "navigate" ||
    url.pathname === "/" ||
    url.pathname === "/index.html"
  ) {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match("/index.html")
      )
    );
    return;
  }

  // その他の静的ファイル
  event.respondWith(
    caches.match(request).then(cached =>
      cached || fetch(request)
    )
  );
});

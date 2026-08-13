const CACHE_NAME = "credtank-site-v48";
const CORE_ASSETS = [
  "/index.html",
  "/login.html",
  "/admin.html",
  "/colaborador.html",
  "/maquininha.html",
  "/portal/app.html",
  "/portal/leitor.html",
  "/landing/index.html",
  "/manifest.json",
  "/assets/Logo.png",
  "/assets/credtank-logo.svg",
  "/assets/qrious.min.js",
  "/assets/jsqr.js",
  "/logo.png",
  "/icon-192.png",
  "/divivig-logo.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/styles.css"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.allSettled(
        CORE_ASSETS.map(async (asset) => {
          try {
            const response = await fetch(asset, { cache: "no-store" });
            if (response && response.ok) {
              await cache.put(asset, response.clone());
            }
          } catch (error) {
          }
        })
      );
    })()
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.pathname.startsWith("/api/") || url.pathname.endsWith(".php")) {
    return;
  }
  if (url.origin !== self.location.origin) {
    return;
  }
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const networkResponse = await fetch(event.request, { cache: "no-store" });
        if (networkResponse && networkResponse.ok) {
          await cache.put(event.request, networkResponse.clone());
        }
        return networkResponse;
      } catch (error) {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        throw error;
      }
    })()
  );
});







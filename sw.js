/* Lingual Kontrol service worker
 *
 * - Sayfanın kendisi (HTML): önce internet, yoksa kayıtlı kopya.
 *   Böylece yeni sürüm yayınlanınca hemen gelir, internet yokken de açılır.
 * - JS/CSS (adları içeriğe göre değişir): önce kayıtlı kopya.
 * - Görseller ve ikonlar: kayıtlı kopyayı hemen göster, arkada güncelle.
 * - Firebase, Google Analytics gibi başka sitelere giden isteklere dokunulmaz.
 */

const CACHE = "lingual-v1";
const SHELL = ["./", "manifest.json", "icons/icon-192.png", "icons/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put("./", response.clone());
    return response;
  } catch (err) {
    return (await cache.match("./")) || Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const update = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  if (cached) {
    event.waitUntil(update);
    return cached;
  }
  return update;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // Firebase, Analytics vb.

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
  } else if (url.pathname.includes("/static/")) {
    event.respondWith(cacheFirst(request));
  } else if (url.pathname.includes("/images/") || url.pathname.includes("/icons/")) {
    event.respondWith(staleWhileRevalidate(request, event));
  }
});

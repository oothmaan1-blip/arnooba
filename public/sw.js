const VERSION = "arnooba-pwa-v1";
const PAGE_CACHE = `${VERSION}-pages`;
const ASSET_CACHE = `${VERSION}-assets`;
const BOOK_CACHE = "arnooba-offline-books-v1";
const OFFLINE_PAGE = "/offline.html";

async function trim(cache, limit) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - limit; i++) await cache.delete(keys[i]);
}

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(ASSET_CACHE).then((cache) => cache.add(OFFLINE_PAGE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys
      .filter((key) => key.startsWith("arnooba-pwa-") && !key.startsWith(VERSION))
      .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Book files are stored only when the reader explicitly asks to save them.
  if (/^\/api\/books\/\d+\/file$/.test(url.pathname)) {
    event.respondWith(caches.open(BOOK_CACHE).then(async (cache) => {
      const saved = await cache.match(request);
      return saved || fetch(request);
    }));
    return;
  }

  if (url.pathname.startsWith("/admin") || url.pathname.startsWith("/api/") || url.pathname.startsWith("/files/")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/_next/image") || url.pathname.startsWith("/pwa/") || url.pathname.startsWith("/pdfjs/")) {
    event.respondWith(caches.open(ASSET_CACHE).then(async (cache) => {
      const saved = await cache.match(request);
      if (saved) return saved;
      const response = await fetch(request);
      if (response.ok) {
        await cache.put(request, response.clone());
        await trim(cache, 120);
      }
      return response;
    }));
    return;
  }

  if (url.pathname.startsWith("/files/covers/") && request.destination === "image") {
    event.respondWith(caches.open(ASSET_CACHE).then(async (cache) => {
      const saved = await cache.match(request);
      if (saved) return saved;
      const response = await fetch(request);
      if (response.ok) {
        await cache.put(request, response.clone());
        await trim(cache, 120);
      }
      return response;
    }));
    return;
  }

  if (request.mode === "navigate") {
    const readerPage = /^\/read\/[^/]+$/.test(url.pathname) && ["pdf", "epub"].includes(url.searchParams.get("format"));
    if (url.search && !readerPage) return;
    const pageKey = readerPage ? url.toString() : new URL(url.pathname, self.location.origin).toString();
    event.respondWith(fetch(request).then(async (response) => {
      const type = response.headers.get("content-type") || "";
      if (response.ok && type.includes("text/html")) {
        const cache = await caches.open(PAGE_CACHE);
        await cache.put(pageKey, response.clone());
        await trim(cache, 40);
      }
      return response;
    }).catch(async () => {
      const cache = await caches.open(PAGE_CACHE);
      return await cache.match(pageKey)
        || await caches.match(OFFLINE_PAGE)
        || new Response("أرنوبة تحتاج اتصالاً بالإنترنت لفتح هذه الصفحة.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
    }));
  }
});

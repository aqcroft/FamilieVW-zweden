const SHELL_CACHE = "zweden-2026-shell-v5";
const RUNTIME_CACHE = "zweden-2026-runtime-v5";
const BASE = self.registration.scope;
const SHELL_FILES = [
  BASE,
  new URL("index.html", BASE).href,
  new URL("manifest.webmanifest", BASE).href,
  new URL("icon-192.svg", BASE).href,
  new URL("icon-512.svg", BASE).href,
  new URL("Rondreis_Zweden_meren_Stockholm_Goteborg_2026.pdf", BASE).href
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => Promise.allSettled(SHELL_FILES.map(url => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(key => ![SHELL_CACHE, RUNTIME_CACHE].includes(key))
        .map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  while (keys.length > maxEntries) {
    await cache.delete(keys.shift());
  }
}

async function networkFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  try {
    const response = await fetch(request);
    if (response && (response.ok || response.type === "opaque")) {
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    return (await cache.match(request)) || (await caches.match(new URL("index.html", BASE).href));
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request)
    .then(response => {
      if (response && (response.ok || response.type === "opaque")) {
        cache.put(request, response.clone());
        trimCache(RUNTIME_CACHE, 320);
      }
      return response;
    })
    .catch(() => null);
  return cached || network;
}

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
    return;
  }

  if (
    url.origin === self.location.origin ||
    url.hostname === "unpkg.com" ||
    url.hostname.endsWith("tile.openstreetmap.org") ||
    url.hostname === "router.project-osrm.org"
  ) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

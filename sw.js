// Service worker: network-first with cache fallback. Fresh code wins when
// online; the cached copy keeps the app working in a dead-zone gym.

const CACHE = "training-tracker-v5";
const PRECACHE = [
  "./",
  "./index.html",
  "./css/app.css",
  "./js/app.js",
  "./js/store.js",
  "./js/rules.js",
  "./js/i18n.js",
  "./js/seed.js",
  "./js/ui/today.js",
  "./js/ui/log.js",
  "./js/ui/stats.js",
  "./js/ui/settings.js",
  "./manifest.json",
  "./icons/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    // cache: "no-cache" forces conditional revalidation against the server,
    // bypassing the HTTP cache's heuristic freshness (which otherwise serves
    // stale modules for files whose mtime is old). Offline still falls back
    // to the SW cache below.
    fetch(event.request, { cache: "no-cache" })
      .then((response) => {
        if (response.ok && new URL(event.request.url).origin === location.origin) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});

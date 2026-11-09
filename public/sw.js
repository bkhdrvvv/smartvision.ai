// SMARTVISION AI service worker — makes the site installable and shows a small offline page.
// Pages and API answers are never cached (camera data must always be live); only the offline page and icons are.
const CACHE = "sv-v1";
const OFFLINE = "/offline.html";

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll([OFFLINE, "/icon.svg", "/icon-192.png"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const r = e.request;
  if (r.method !== "GET" || r.mode !== "navigate") return; // everything else goes straight to the network
  e.respondWith(fetch(r).catch(() => caches.match(OFFLINE)));
});

// Offline support.
// - App pages: network first (updates show up), cache as fallback.
// - Pinned emulator files in ./emulatorjs never change: cache first.
const SHELL = "gba-shell-v8";
const EMU = "gba-emu-4.2.3";
const FONTS = "gba-fonts-v1";
const SHELL_FILES = [
  "./", "./index.html", "./manifest.webmanifest", "./covers.json",
  "./icons/icon-192.png", "./icons/icon-512.png", "./icons/apple-touch-icon.png",
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== EMU && k !== FONTS).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // Web fonts: cache first so the app keeps its look offline.
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(caches.open(FONTS).then(async cache => {
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok || res.type === "opaque") cache.put(req, res.clone());
      return res;
    }));
    return;
  }
  if (url.origin !== location.origin) return;   // GitHub API, cover images: straight to network

  if (url.pathname.includes("/emulatorjs/")) {
    e.respondWith(caches.open(EMU).then(async cache => {
      const hit = await cache.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) cache.put(req, res.clone());
      return res;
    }));
    return;
  }

  e.respondWith(fetch(url.href, { cache: "no-cache" }).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(SHELL).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req).then(r => r || caches.match("./index.html"))));
});

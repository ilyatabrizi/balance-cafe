/* Balance — service worker.
   The menu should open on the café's own patchy wifi, so the shell and the
   photography are precached and served cache-first. HTML goes to the network
   first so a redeploy is picked up on the next visit, not the one after. */

const VERSION = "balance-v2";
const SHELL = `${VERSION}-shell`;
const MEDIA = `${VERSION}-media`;

const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./css/app.css",
  "./js/app.js",
  "./js/router.js",
  "./js/store.js",
  "./js/data.js",
  "./js/ui.js",
  "./js/util.js",
  "./js/icons.js",
  "./js/config.js",
  "./js/motion.js",
  "./js/presence.js",
  "./js/install.js",
  "./js/views/home.js",
  "./js/views/menu.js",
  "./js/views/item.js",
  "./js/views/checkin.js",
  "./js/views/bag.js",
  "./js/views/order.js",
  "./js/views/account.js",
  "./assets/brand/logo.svg",
  "./assets/brand/mark.svg",
  "./assets/fonts/satoshi-400.woff2",
  "./assets/fonts/satoshi-500.woff2",
  "./assets/fonts/satoshi-700.woff2",
  "./assets/fonts/fraunces-latin.woff2",
  "./assets/photos/interior-bar@2x.jpg",
  "./assets/icons/icon-192.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(SHELL);
    // One bad URL must not fail the whole install.
    await Promise.all(PRECACHE.map((u) =>
      cache.add(new Request(u, { cache: "reload" })).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

const isMedia = (url) =>
  /\.(png|jpe?g|webp|svg|woff2?)$/i.test(url.pathname);

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network first, so a new deploy lands immediately.
  if (request.mode === "navigate") {
    e.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        const cache = await caches.open(SHELL);
        cache.put("./index.html", fresh.clone());
        return fresh;
      } catch {
        return (await caches.match("./index.html")) || Response.error();
      }
    })());
    return;
  }

  // Photos, fonts, icons: cache first, they are content-stable.
  if (isMedia(url)) {
    e.respondWith((async () => {
      const hit = await caches.match(request);
      if (hit) return hit;
      try {
        const fresh = await fetch(request);
        if (fresh.ok) (await caches.open(MEDIA)).put(request, fresh.clone());
        return fresh;
      } catch {
        return hit || Response.error();
      }
    })());
    return;
  }

  // Code and everything else: stale-while-revalidate.
  e.respondWith((async () => {
    const cache = await caches.open(SHELL);
    const hit = await cache.match(request);
    const net = fetch(request).then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    }).catch(() => null);
    return hit || (await net) || Response.error();
  })());
});

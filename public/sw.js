const CACHE_NAME = "arcus-shell-v12";
const APP_ROUTES = ["/", "/welcome", "/login", "/signup", "/dashboard", "/workout", "/history", "/exercises", "/programs", "/progress", "/profile", "/profile/data", "/profile/edit", "/recaps", "/exercises/barbell-bench-press", "/history/offline", "/programs/offline", "/workout/complete/offline", "/sounds/timer-done.wav", "/demos/placeholder.svg", "/manifest.webmanifest", "/icon.svg", "/arcus-mark.svg", "/arcus-moon-logo.png", "/icons/brand-64.png", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/maskable-512.png", "/icons/apple-touch-icon.png", "/offline.html"];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    const bundles=new Set();
    await Promise.allSettled(APP_ROUTES.map(async (path) => {
      const response = await fetch(path, { cache: "reload" });
      if(response.ok){
        if(response.headers.get("content-type")?.includes("text/html")){
          const html=await response.clone().text();
          for(const match of html.matchAll(/(?:src|href)="([^"<>]+)"/g))if(match[1].startsWith("/_next/static/"))bundles.add(match[1]);
        }
        await cache.put(path,response);
      }
    }));
    // Fetch code and CSS as well as HTML so unopened feature pages can hydrate offline.
    await Promise.allSettled([...bundles].map(async path=>{const response=await fetch(path);if(response.ok&&!response.headers.get("cache-control")?.includes("no-store"))await cache.put(path,response);}));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter((name) => (name.startsWith("forge-shell-") || name.startsWith("arcus-shell-")) && name !== CACHE_NAME).map((name) => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(url.pathname, response.clone());
        }
        return response;
      } catch {
        const cache = await caches.open(CACHE_NAME);
        const shell=url.pathname.startsWith("/exercises/")?"/exercises/barbell-bench-press":url.pathname.startsWith("/history/")?"/history/offline":url.pathname.startsWith("/programs/")?"/programs/offline":url.pathname.startsWith("/workout/complete/")?"/workout/complete/offline":null;
        return (await cache.match(url.pathname)) || (shell&&await cache.match(shell)) || (await cache.match("/offline.html")) || (await cache.match("/"));
      }
    })());
    return;
  }

  // Next.js soft navigation requests use RSC fetches rather than document navigations.
  if (url.searchParams.has("_rsc") || request.headers.get("RSC") === "1") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        return (await cache.match(request)) || new Response("This page has not been opened while online yet.", { status: 503 });
      }
    })());
    return;
  }

  // Dev bundle URLs stay the same across edits. Fetch current code first so new
  // server HTML cannot hydrate against an older cached component implementation.
  // Production's immutable bundles still benefit from the browser's HTTP cache;
  // the shell cache remains a fallback when the network is unavailable.
  if (url.pathname.startsWith("/_next/")) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response.headers.get("cache-control")?.includes("no-store")) await cache.delete(request);
        else if (response.ok) await cache.put(request, response.clone());
        return response;
      } catch {
        return (await cache.match(request)) || Response.error();
      }
    })());
    return;
  }

  if (["script", "style", "image", "font", "audio", "video"].includes(request.destination)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })());
  }
});

self.addEventListener("notificationclick",(event)=>{event.notification.close();const url=event.notification.data?.url||"/recaps";event.waitUntil(clients.matchAll({type:"window"}).then(async(windows)=>{const existing=windows.find(w=>new URL(w.url).origin===self.location.origin);if(existing){await existing.navigate(url);return existing.focus();}return clients.openWindow(url);}));});

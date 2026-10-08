/** Runs from fresh server HTML, even when an old worker serves stale dev bundles. */
export const DEVELOPMENT_WORKER_RESET = `(() => {
  if (!("serviceWorker" in navigator)) return;
  const belongsToArcus = worker => {
    if (!worker) return false;
    const url = new URL(worker.scriptURL, location.origin);
    return url.origin === location.origin && url.pathname === "/sw.js";
  };
  const wasControlled = belongsToArcus(navigator.serviceWorker.controller);
  return (async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations
      .filter(registration => [registration.active, registration.waiting, registration.installing].some(belongsToArcus))
      .map(registration => registration.unregister()));
    if ("caches" in window) {
      const names = await caches.keys();
      await Promise.all(names
        .filter(name => name.startsWith("arcus-shell-") || name.startsWith("forge-shell-"))
        .map(name => caches.delete(name)));
    }
    if (wasControlled) location.reload();
  })().catch(() => console.warn("ARCUS could not reset its development asset cache."));
})();`;

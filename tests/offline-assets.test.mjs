import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { DEVELOPMENT_WORKER_RESET } from "../src/features/offline/development-worker-reset.ts";

const origin = "https://arcus.example";
const workerSource = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");

test("dev startup removes only ARCUS workers and shell caches, then reloads a controlled tab", async () => {
  const removed = [], warnings = [];
  let reloads = 0;
  const worker = { scriptURL: `${origin}/sw.js` };
  const registrations = [
    { active: worker, unregister: async () => removed.push("arcus-worker") },
    { active: { scriptURL: `${origin}/other-worker.js` }, unregister: async () => removed.push("other-worker") },
  ];
  const cacheStorage = {
    keys: async () => ["arcus-shell-v10", "forge-shell-v1", "unrelated-cache"],
    delete: async name => removed.push(name),
  };
  await runInNewContext(DEVELOPMENT_WORKER_RESET, {
    URL, navigator: { serviceWorker: { controller: worker, getRegistrations: async () => registrations } },
    location: { origin, reload: () => reloads++ }, window: { caches: cacheStorage }, caches: cacheStorage,
    indexedDB: { deleteDatabase: () => assert.fail("Account/workout databases must be preserved") },
    localStorage: { clear: () => assert.fail("Preferences must be preserved") },
    console: { warn: message => warnings.push(message) },
  });
  assert.deepEqual(removed.sort(), ["arcus-shell-v10", "arcus-worker", "forge-shell-v1"].sort());
  assert.equal(reloads, 1);
  assert.deepEqual(warnings, []);
});

test("dev startup does not reload uncontrolled tabs or unregister unrelated workers", async () => {
  let reloads = 0;
  const unrelated = { scriptURL: `${origin}/other-worker.js` };
  await runInNewContext(DEVELOPMENT_WORKER_RESET, {
    URL, navigator: { serviceWorker: { controller: unrelated, getRegistrations: async () => [
      { active: unrelated, unregister: () => assert.fail("Unrelated worker must be preserved") },
    ] } },
    location: { origin, reload: () => reloads++ }, window: {}, console,
  });
  assert.equal(reloads, 0);
  assert.doesNotThrow(() => runInNewContext(DEVELOPMENT_WORKER_RESET, { navigator: {} }));
});

test("failed dev cleanup does not produce a reload loop", async () => {
  const warnings = [];
  await runInNewContext(DEVELOPMENT_WORKER_RESET, {
    URL, navigator: { serviceWorker: {
      controller: { scriptURL: `${origin}/sw.js` },
      getRegistrations: async () => { throw new Error("Storage unavailable"); },
    } },
    location: { origin, reload: () => assert.fail("Failed cleanup must not reload") }, window: {},
    console: { warn: message => warnings.push(message) },
  });
  assert.equal(warnings.length, 1);
});

function runWorker(networkFetch, initialCache = new Map()) {
  const handlers = new Map();
  const cache = {
    match: async request => initialCache.get(request.url)?.clone(),
    put: async (request, response) => initialCache.set(request.url, response.clone()),
    delete: async request => initialCache.delete(request.url),
  };
  runInNewContext(workerSource, {
    URL, Response, fetch: networkFetch, caches: { open: async () => cache },
    self: { location: { origin }, addEventListener: (name, handler) => handlers.set(name, handler) },
  });
  return {
    async request(path, destination = "script") {
      let response;
      handlers.get("fetch")({
        request: { url: `${origin}${path}`, method: "GET", mode: "cors", headers: new Headers(), destination },
        respondWith: result => { response = result; },
      });
      return response;
    },
    cache: initialCache,
  };
}

test("Next dev bundles use fresh network code and remove a cached no-store version", async () => {
  const path = "/_next/static/chunks/app/dashboard/page.js";
  const cache = new Map([[`${origin}${path}`, new Response("old calendar code")]]);
  let requests = 0;
  const worker = runWorker(async () => {
    requests++;
    return new Response("current calendar code", { headers: { "cache-control": "no-store, must-revalidate" } });
  }, cache);
  assert.equal(await (await worker.request(path)).text(), "current calendar code");
  assert.equal(requests, 1);
  assert.equal(cache.has(`${origin}${path}`), false);
});

test("production bundles update online and remain available offline", async () => {
  let online = true;
  const worker = runWorker(async () => {
    if (!online) throw new TypeError("Offline");
    return new Response("production bundle", { headers: { "cache-control": "public, max-age=31536000, immutable" } });
  });
  const path = "/_next/static/chunks/app/dashboard/page-12345678.js";
  assert.equal(await (await worker.request(path)).text(), "production bundle");
  online = false;
  assert.equal(await (await worker.request(path)).text(), "production bundle");
  assert.equal((await worker.request("/_next/static/missing.js")).type, "error");
});

test("normal image assets retain their cache-first behavior", async () => {
  const path = "/arcus-mark.svg";
  const worker = runWorker(() => assert.fail("Cached images should not need the network"), new Map([
    [`${origin}${path}`, new Response("cached logo")],
  ]));
  assert.equal(await (await worker.request(path, "image")).text(), "cached logo");
});

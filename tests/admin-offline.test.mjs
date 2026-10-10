import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");

test("admin documents, APIs and RSC navigation bypass offline cache even when an old snapshot exists", () => {
  const handlers = new Map();
  runInNewContext(source, {
    URL, Response, caches: { open: () => assert.fail("Admin data must never read a cache") },
    fetch: () => assert.fail("The worker must leave admin requests to the browser"),
    self: { location: { origin: "https://arcus.example" }, addEventListener: (name, fn) => handlers.set(name, fn) },
  });
  for (const path of ["/admin", "/admin/users", "/admin/exercises?q=bench", "/admin/users?_rsc=private", "/api/admin/users"]) {
    for (const mode of ["navigate", "cors"]) {
      handlers.get("fetch")({ request: {
        url: `https://arcus.example${path}`, method: "GET", mode,
        headers: new Headers({ RSC: "1" }),
      }, respondWith: () => assert.fail("Admin requests must not be intercepted") });
    }
  }
});

test("runtime kill-switch checks always reach the server instead of using a stale offline response", () => {
  const handlers = new Map();
  runInNewContext(source, {
    URL, Response, caches: { open: () => assert.fail("Runtime flags must never be read from cache") },
    fetch: () => assert.fail("The worker must leave runtime flags to the browser"),
    self: { location: { origin: "https://arcus.example" }, addEventListener: (name, fn) => handlers.set(name, fn) },
  });
  handlers.get("fetch")({ request: {
    url: "https://arcus.example/api/runtime-flags", method: "GET", mode: "cors", headers: new Headers(),
  }, respondWith: () => assert.fail("Runtime flag checks must not be intercepted") });
});

test("private no-store HTML and RSC responses never enter the shell cache", async () => {
  const handlers = new Map();
  let response;
  runInNewContext(source, {
    URL, Response,
    fetch: async () => new Response("private content", { headers: { "cache-control": "private, no-store" } }),
    caches: { open: async () => ({ put: () => assert.fail("Private responses must not be persisted") }) },
    self: { location: { origin: "https://arcus.example" }, addEventListener: (name, fn) => handlers.set(name, fn) },
  });
  for (const mode of ["navigate", "cors"]) {
    handlers.get("fetch")({ request: { url: "https://arcus.example/dashboard?_rsc=1", method: "GET", mode, headers: new Headers({ RSC: "1" }) }, respondWith: value => { response = value; } });
    assert.equal(await (await response).text(), "private content");
  }
});

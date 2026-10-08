// Live integration check. Creates one disposable account and removes it in finally.
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { setTimeout as pause } from "node:timers/promises";
import { loadPortwaysEnv } from "./portways-env.mjs";
import { createPortwaysPool } from "../src/lib/db/portways-pool.mjs";

await loadPortwaysEnv();
const origin = process.env.ARCUS_TEST_URL ?? "http://127.0.0.1:3000";
const pool = createPortwaysPool({ max: 1 });
const username = `avatar_check_${randomUUID().slice(0, 8)}`;
const password = randomBytes(24).toString("base64url");
const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=";
const expectedBytes = Buffer.from(png.split(",")[1], "base64");
let accountId;

async function request(path, body, cookie, expectedStatus = 200) {
  // Space checks to respect the gateway's sustained query limit.
  await pause(1100);
  const response = await fetch(new URL(path, origin), {
    method: body === undefined ? "GET" : path === "/api/auth/profile" ? "PUT" : "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  assert.equal(response.status, expectedStatus, `${path} returned unexpected status`);
  return { payload: await response.json(), cookie: response.headers.get("set-cookie")?.split(";")[0] };
}

try {
  const signup = await request("/api/auth/signup", { username, password, email: `${username}@example.invalid`, name: "Avatar integration check" }, undefined, 201);
  accountId = signup.payload.user.id;
  assert.ok(signup.cookie, "Signup must return a session cookie");
  const saved = await request("/api/auth/profile", { avatarUrl: png }, signup.cookie);
  assert.equal(saved.payload.user.profile.avatarUrl, png);
  const { rows } = await pool.query("select pg_typeof(avatar_image)::text as storage_type, avatar_image, avatar_mime_type from public.arcus_accounts where id = $1 and username_normalized = $2", [accountId, username]);
  assert.equal(rows[0].storage_type, "bytea");
  assert.equal(rows[0].avatar_mime_type, "image/png");
  assert.ok(rows[0].avatar_image.equals(expectedBytes), "Database must contain the decoded photo bytes");
  console.log("PASS: Profile upload stores binary photo bytes in PostgreSQL.");

  const me = await request("/api/auth/me", undefined, signup.cookie);
  assert.equal(me.payload.user.profile.avatarUrl, png);
  const login = await request("/api/auth/login", { username, password });
  assert.equal(login.payload.user.profile.avatarUrl, png);
  console.log("PASS: Session lookup and a new login retrieve the same photo.");

  const preserved = await request("/api/auth/profile", { bio: "Keep my photo" }, login.cookie);
  assert.equal(preserved.payload.user.profile.avatarUrl, png);
  await request("/api/auth/profile", { avatarUrl: png.replace("image/png", "image/jpeg") }, login.cookie, 400);
  const oversized = `data:image/png;base64,${Buffer.alloc(512 * 1024 + 1).toString("base64")}`;
  await request("/api/auth/profile", { avatarUrl: oversized }, login.cookie, 413);
  await request("/api/auth/profile", { avatarUrl: null }, undefined, 401);
  const unchanged = await request("/api/auth/me", undefined, login.cookie);
  assert.equal(unchanged.payload.user.profile.avatarUrl, png);
  console.log("PASS: Omission preserves the photo; invalid, oversized, and unauthenticated changes are rejected.");

  const removed = await request("/api/auth/profile", { avatarUrl: null }, login.cookie);
  assert.equal(removed.payload.user.profile.avatarUrl, null);
  const cleared = await pool.query("select avatar_image is null and avatar_mime_type is null as cleared from public.arcus_accounts where id = $1 and username_normalized = $2", [accountId, username]);
  assert.equal(cleared.rows[0].cleared, true);
  console.log("PASS: Remove photo clears both database columns.");
} finally {
  // Guard by the generated username even if signup succeeded before an assertion failed.
  await pause(1100);
  await pool.query("delete from public.arcus_accounts where username_normalized = $1 and ($2::uuid is null or id = $2::uuid)", [username, accountId ?? null]);
  await pool.end();
  console.log("Disposable account and its sessions removed.");
}

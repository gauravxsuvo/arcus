import assert from "node:assert/strict";
import test from "node:test";
import { avatarDataUrl, MAX_AVATAR_BYTES, MAX_PROFILE_BODY_BYTES, parseAvatar, ProfileInputError, readProfileBody } from "../src/lib/auth/avatar.ts";

const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=";

test("avatar bytes round trip without storing base64 in PostgreSQL", () => {
  const avatar = parseAvatar(png);
  assert.ok(Buffer.isBuffer(avatar.bytes));
  assert.equal(avatar.mimeType, "image/png");
  assert.equal(avatarDataUrl(avatar.bytes, avatar.mimeType), png);
  assert.equal(avatarDataUrl(null, null), null);
});

test("photo omission preserves and null removes", () => {
  assert.equal(parseAvatar(undefined), undefined);
  assert.equal(parseAvatar(null), null);
});

test("unsafe formats, malformed base64, and mismatched signatures are rejected", () => {
  for (const input of [42, "https://example.com/photo.png", "data:image/svg+xml;base64,PHN2Zz4=", png.replace("image/png", "image/jpeg"), "data:image/png;base64,AAAA=", "data:image/png;base64,aGVsbG8="]) {
    assert.throws(() => parseAvatar(input), (error) => error instanceof ProfileInputError && error.status === 400);
  }
});

test("decoded upload size is capped, including base64 padding edge cases", () => {
  const oversized = `data:image/png;base64,${Buffer.alloc(MAX_AVATAR_BYTES + 1).toString("base64")}`;
  assert.throws(() => parseAvatar(oversized), (error) => error.status === 413);
});

test("JPEG and WebP signatures are supported", () => {
  for (const [mime, bytes] of [["image/jpeg", Buffer.from([255, 216, 255, 224, 255, 217])], ["image/webp", Buffer.from("RIFF0000WEBP")]]) {
    assert.equal(parseAvatar(avatarDataUrl(bytes, mime)).mimeType, mime);
  }
});

test("profile body rejects malformed JSON and non-object payloads", async () => {
  for (const body of ["not-json", "null", "[]"]) {
    await assert.rejects(readProfileBody(new Request("http://localhost", { method: "PUT", body })), (error) => error.status === 400);
  }
  assert.deepEqual(await readProfileBody(new Request("http://localhost", { method: "PUT", body: '{"avatarUrl":null}' })), { avatarUrl: null });
});

test("profile body cap works without trusting content-length", async () => {
  const request = new Request("http://localhost", { method: "PUT", body: " ".repeat(MAX_PROFILE_BODY_BYTES + 1) });
  await assert.rejects(readProfileBody(request), (error) => error.status === 413);
  const declared = new Request("http://localhost", { method: "PUT", body: "{}", headers: { "content-length": String(MAX_PROFILE_BODY_BYTES + 1) } });
  await assert.rejects(readProfileBody(declared), (error) => error.status === 413);
});

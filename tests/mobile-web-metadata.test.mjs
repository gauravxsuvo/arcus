import test from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { siteOrigin, socialMetadata, SITE_TITLE } from "../src/lib/site-metadata.ts";
import { THEME_BOOTSTRAP, THEME_COLORS } from "../src/features/profile/theme.ts";

test("sharing URLs use the configured production origin without paths or query parameters", () => {
  const environment = { SITE_URL: " https://training.example/dashboard?source=preview ", VERCEL_URL: "preview.vercel.app" };
  const metadata = socialMetadata(environment);
  assert.equal(metadata.metadataBase.href, "https://training.example/");
  assert.equal(metadata.openGraph.url, "https://training.example/");
  assert.equal(metadata.openGraph.title, SITE_TITLE);
  assert.equal(metadata.openGraph.images[0].url, "https://training.example/og/arcus-share.png");
  assert.equal(metadata.twitter.card, "summary_large_image");
  assert.equal(metadata.twitter.images[0].url, metadata.openGraph.images[0].url);
});

test("Vercel's production domain takes priority over a temporary preview domain", () => {
  assert.equal(siteOrigin({ VERCEL_PROJECT_PRODUCTION_URL: "arcus.example", VERCEL_URL: "preview.vercel.app" }).href, "https://arcus.example/");
  assert.equal(siteOrigin({ VERCEL_URL: "preview.vercel.app" }).href, "https://preview.vercel.app/");
  assert.equal(siteOrigin({ SITE_URL: " " }).href, "http://localhost:3000/");
});

test("sharing metadata rejects credentials and non-web origins without exposing their values", () => {
  for (const SITE_URL of ["https://user:private-password@example.com", "file:///private/site", "javascript:alert(1)", "invalid private-password"]) {
    assert.throws(() => siteOrigin({ SITE_URL }), error => {
      assert.equal(error.message, "SITE_URL must be a public HTTP(S) URL without credentials.");
      return true;
    });
  }
});

function bootTheme({ saved = "light", existingMeta = true, blockedStorage = false } = {}) {
  let meta = existingMeta ? { content: THEME_COLORS.dark } : null;
  let insertions = 0;
  const document = {
    documentElement: { dataset: {} },
    head: { appendChild: element => { meta = element; insertions += 1; } },
    querySelector: () => meta,
    createElement: tag => { assert.equal(tag, "meta"); return {}; },
  };
  const context = {
    document,
    localStorage: { getItem: () => { if (blockedStorage) throw new Error("Storage unavailable"); return saved; } },
  };
  runInNewContext(THEME_BOOTSTRAP, context);
  return {
    document, getMeta: () => meta,
    rerun: () => runInNewContext(THEME_BOOTSTRAP, context), insertions: () => insertions,
  };
}

test("saved light theme immediately updates both the canvas and existing browser metadata", () => {
  const result = bootTheme();
  assert.equal(result.document.documentElement.dataset.theme, "light");
  assert.equal(result.getMeta().content, THEME_COLORS.light);
});

test("theme bootstrapping immediately creates one mutable tag and never duplicates it", () => {
  const result = bootTheme({ existingMeta: false });
  assert.equal(result.document.documentElement.dataset.theme, "light");
  assert.equal(result.getMeta().content, THEME_COLORS.light);
  assert.equal(result.getMeta().name, "theme-color");
  assert.equal(result.insertions(), 1);
  result.rerun();
  assert.equal(result.insertions(), 1);
});

test("blocked storage and invalid preferences fall back to a usable dark status bar", () => {
  const result = bootTheme({ existingMeta: false, blockedStorage: true });
  assert.equal(result.document.documentElement.dataset.theme, "dark");
  assert.equal(result.getMeta().content, THEME_COLORS.dark);
  assert.equal(bootTheme({ saved: "invalid" }).getMeta().content, THEME_COLORS.dark);
});

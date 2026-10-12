import { readFile } from "node:fs/promises";
import { loadPortwaysEnv } from "./portways-env.mjs";
import { createPortwaysPool } from "../src/lib/db/portways-pool.mjs";
import { backfillSocialPrCounts } from "./backfill-social-pr-counts.mjs";

await loadPortwaysEnv();
const pool = createPortwaysPool({ max: 1 });
try {
  const sql = await readFile(new URL("../supabase/migrations/0022_social_feed_precomputed_metrics.sql", import.meta.url), "utf8");
  await pool.query(sql);
  await backfillSocialPrCounts(pool);
  console.log("ARCUS social feed metrics and counters are ready in Portways PostgreSQL.");
} catch (error) {
  const detail = error && typeof error === "object" ? error : {};
  const code = typeof detail.code === "string" ? detail.code : "unavailable";
  const message = typeof detail.message === "string" ? detail.message : "Database connection or migration step failed.";
  console.error(`Social feed performance migration failed (${code}): ${message}`);
  process.exitCode = 1;
} finally {
  await pool.end();
}

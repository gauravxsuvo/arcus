import { readFile } from "node:fs/promises";
import { loadPortwaysEnv } from "./portways-env.mjs";
import { createPortwaysPool } from "../src/lib/db/portways-pool.mjs";
import { backfillSocialPrCounts } from "./backfill-social-pr-counts.mjs";

await loadPortwaysEnv();

const sql = await readFile(new URL("../supabase/portways.sql", import.meta.url), "utf8");
const socialPerformanceSql = await readFile(new URL("../supabase/migrations/0022_social_feed_precomputed_metrics.sql", import.meta.url), "utf8");
const pool = createPortwaysPool({ max: 1 });

try {
  await pool.query(sql);
  await pool.query(socialPerformanceSql);
  await backfillSocialPrCounts(pool);
  console.log("Portways database tables are ready.");
} finally {
  await pool.end();
}

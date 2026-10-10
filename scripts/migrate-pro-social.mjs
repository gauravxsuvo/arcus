import { readFile } from "node:fs/promises";
import { loadPortwaysEnv } from "./portways-env.mjs";
import { createPortwaysPool } from "../src/lib/db/portways-pool.mjs";

await loadPortwaysEnv();
const sql = await readFile(new URL("../supabase/migrations/0010_pro_subscriptions_social_feed.sql", import.meta.url), "utf8");
const pool = createPortwaysPool({ max: 1 });
try {
  await pool.query(sql);
  console.log("ARCUS Pro subscription and social-feed schema is ready in Portways PostgreSQL.");
} catch (error) {
  const details = typeof error === "object" && error !== null ? error : null;
  const nested = details && "error" in details && details.error && typeof details.error === "object"
    ? details.error
    : details && "cause" in details && details.cause && typeof details.cause === "object" ? details.cause : null;
  const rawCode = details && "code" in details ? details.code : nested && "code" in nested ? nested.code : null;
  const code = typeof rawCode === "string" ? rawCode : "database error";
  const safeReason = code === "ENOTFOUND" ? "DNS could not resolve db.portways.app"
    : code === "ECONNREFUSED" ? "the database gateway refused the network connection"
    : code === "ETIMEDOUT" ? "the database gateway connection timed out"
    : /^[0-9A-Z]{5}$/.test(code) ? `PostgreSQL returned SQLSTATE ${code}`
    : "gateway details were omitted to protect credentials";
  console.error(`Pro/social migration failed: ${safeReason}. No automatic retry was attempted.`);
  process.exitCode = 1;
} finally {
  await pool.end();
}

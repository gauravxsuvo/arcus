import { readFile } from "node:fs/promises";
import { loadPortwaysEnv } from "./portways-env.mjs";
import { createPortwaysPool } from "../src/lib/db/portways-pool.mjs";

await loadPortwaysEnv();
const pool = createPortwaysPool({ max: 1 });
try {
  const sql = await readFile(new URL("../supabase/migrations/0015_routines.sql", import.meta.url), "utf8");
  await pool.query(sql);
  console.log("ARCUS routine templates are ready in Portways PostgreSQL.");
} catch (error) {
  const details = typeof error === "object" && error !== null ? error : null;
  const nested = details && "error" in details && details.error && typeof details.error === "object"
    ? details.error
    : details && "cause" in details && details.cause && typeof details.cause === "object" ? details.cause : null;
  const rawCode = details && "code" in details ? details.code : nested && "code" in nested ? nested.code : null;
  const code = typeof rawCode === "string" ? rawCode : "unavailable";
  const reason = code === "ENOTFOUND" ? "DNS could not resolve the Portways gateway"
    : code === "ECONNREFUSED" ? "the gateway refused the network connection"
    : code === "ETIMEDOUT" ? "the database gateway connection timed out"
    : /^[0-9A-Z]{5}$/.test(code) ? `PostgreSQL returned SQLSTATE ${code}`
    : `the database operation failed (${code})`;
  console.error(`Routine migration failed: ${reason}. No credential values were printed.`);
  process.exitCode = 1;
} finally {
  await pool.end();
}

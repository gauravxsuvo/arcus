import { readFile } from "node:fs/promises";
import { loadPortwaysEnv } from "./portways-env.mjs";
import { createPortwaysPool } from "../src/lib/db/portways-pool.mjs";

await loadPortwaysEnv();
const pool = createPortwaysPool({ max: 1 });
try {
  const sql = await readFile(new URL("../supabase/migrations/0017_sleep_readiness.sql", import.meta.url), "utf8");
  await pool.query(sql);
  console.log("ARCUS sleep and readiness storage is ready in Portways PostgreSQL.");
} catch (error) {
  const detail = error && typeof error === "object" ? error : {};
  const code = typeof detail.code === "string" ? detail.code : "unavailable";
  console.error(`Sleep and readiness migration failed (${code}). No credential values were printed.`);
  process.exitCode = 1;
} finally {
  await pool.end();
}

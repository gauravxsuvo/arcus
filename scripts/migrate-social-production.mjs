import { readFile } from "node:fs/promises";
import { loadPortwaysEnv } from "./portways-env.mjs";
import { createPortwaysPool } from "../src/lib/db/portways-pool.mjs";
await loadPortwaysEnv();
const pool=createPortwaysPool({ max:1 });
try {
  const sql=await readFile(new URL("../supabase/migrations/0014_social_production.sql",import.meta.url),"utf8");
  await pool.query(sql);
  console.log("Production social constraints and indexes installed.");
} catch(error) {
  console.error("Social migration failed; SQLSTATE:",typeof error?.code==="string" ? error.code : "unavailable");
  process.exitCode=1;
} finally { await pool.end(); }

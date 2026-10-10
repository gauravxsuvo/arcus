import { readFile } from "node:fs/promises";
import { loadPortwaysEnv } from "./portways-env.mjs";
import { createPortwaysPool } from "../src/lib/db/portways-pool.mjs";

await loadPortwaysEnv();
const sql = await readFile(new URL("../supabase/migrations/0009_admin_rbac_moderation_broadcast.sql", import.meta.url), "utf8");
const pool = createPortwaysPool({ max: 1 });
try {
  await pool.query(sql);
  console.log("ARCUS RBAC, moderation, audit, and broadcast schema is ready in Portways PostgreSQL.");
} catch (error) {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "database error";
  console.error(`Admin RBAC migration failed (${code}). No automatic retry was attempted.`);
  process.exitCode = 1;
} finally { await pool.end(); }

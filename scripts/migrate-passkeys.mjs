import { readFile } from "node:fs/promises";
import { loadPortwaysEnv } from "./portways-env.mjs";
import { createPortwaysPool } from "../src/lib/db/portways-pool.mjs";

await loadPortwaysEnv();
const sql = await readFile(new URL("../supabase/migrations/0006_passkeys.sql", import.meta.url), "utf8");
const pool = createPortwaysPool({ max: 1 });

try {
  await pool.query(sql);
  console.log("Passkey credential and challenge tables are ready in Portways PostgreSQL.");
} catch (error) {
  const details = typeof error === "object" && error !== null
    ? "code" in error ? String(error.code) : "name" in error ? String(error.name) : "database error"
    : "database error";
  console.error(`Passkey migration failed (${details}). No automatic retry was attempted.`);
  process.exitCode = 1;
} finally {
  await pool.end();
}

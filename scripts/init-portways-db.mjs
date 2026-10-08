import { readFile } from "node:fs/promises";
import pg from "pg";
import { loadPortwaysEnv } from "./portways-env.mjs";

await loadPortwaysEnv();

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const sql = await readFile(new URL("../supabase/portways.sql", import.meta.url), "utf8");
const pool = new Pool({
  connectionString,
  max: 5,
  idleTimeoutMillis: 10 * 60 * 1000,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 30_000,
  idle_in_transaction_session_timeout: 60_000,
});

try {
  await pool.query(sql);
  console.log("Portways database tables are ready.");
} finally {
  await pool.end();
}

import { readFile } from "node:fs/promises";
import { loadPortwaysEnv } from "./portways-env.mjs";
import { createPortwaysPool } from "../src/lib/db/portways-pool.mjs";

await loadPortwaysEnv();

const sql = await readFile(new URL("../supabase/portways.sql", import.meta.url), "utf8");
const pool = createPortwaysPool({ max: 1 });

try {
  await pool.query(sql);
  console.log("Portways database tables are ready.");
} finally {
  await pool.end();
}

import pg from "pg";
import { loadPortwaysEnv } from "./portways-env.mjs";

await loadPortwaysEnv();

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const pool = new Pool({
  connectionString,
  max: 5,
  idleTimeoutMillis: 10 * 60 * 1000,
  connectionTimeoutMillis: 10_000,
  statement_timeout: 30_000,
  idle_in_transaction_session_timeout: 60_000,
});

try {
  const result = await pool.query("select current_user as current_user");
  const currentUser = result.rows[0].current_user;
  console.log(`Connected to PostgreSQL as ${currentUser}.`);
  if (currentUser !== "pw_remote") {
    console.error("Expected current_user to be pw_remote; check the bridge credentials.");
    process.exitCode = 1;
  }
} finally {
  await pool.end();
}

import "server-only";
import pg from "pg";

const { Pool } = pg;

const shared=globalThis as typeof globalThis & {arcusDatabasePool?:pg.Pool};

export function getDatabasePool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured.");
  if (!shared.arcusDatabasePool) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 10 * 60 * 1000,
      connectionTimeoutMillis: 10_000,
      statement_timeout: 30_000,
      idle_in_transaction_session_timeout: 60_000,
    });
    pool.on("error", () => {
      console.warn("An idle PostgreSQL connection was dropped; the pool will open a replacement when needed.");
    });
    shared.arcusDatabasePool=pool;
  }
  return shared.arcusDatabasePool;
}

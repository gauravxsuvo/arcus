import "server-only";

import type { Pool } from "@neondatabase/serverless";
import { createPortwaysPool } from "./portways-pool.mjs";

const shared = globalThis as typeof globalThis & { arcusDatabasePool?: Pool };

export function getDatabasePool() {
  if (!shared.arcusDatabasePool) {
    const pool = createPortwaysPool({ max: 3 });
    pool.on("error", () => {
      console.warn("An idle Portways PostgreSQL connection was dropped; the pool will reconnect when needed.");
    });
    shared.arcusDatabasePool = pool;
  }
  return shared.arcusDatabasePool;
}

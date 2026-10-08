import { loadPortwaysEnv } from "./portways-env.mjs";
import { createPortwaysPool } from "../src/lib/db/portways-pool.mjs";

await loadPortwaysEnv();

const pool = createPortwaysPool({ max: 1 });

try {
  const result = await pool.query("select current_user as current_user");
  const currentUser = result.rows[0].current_user;
  console.log(`Connected to Portways PostgreSQL as ${currentUser}.`);
  if (currentUser !== "pw_remote") {
    console.error("Expected current_user to be pw_remote; check the Portways database credentials.");
    process.exitCode = 1;
  }
} finally {
  await pool.end();
}

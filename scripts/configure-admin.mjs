import { readFile, writeFile } from "node:fs/promises";
import { loadPortwaysEnv } from "./portways-env.mjs";
import { createPortwaysPool } from "../src/lib/db/portways-pool.mjs";

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("Usage: npm run admin:configure -- owner@example.com");
  process.exit(1);
}

await loadPortwaysEnv();
const pool = createPortwaysPool({ max: 1 });
try {
  const result = await pool.query("select id from public.arcus_accounts where email_normalized = $1 limit 1", [email]);
  const id = result.rows[0]?.id;
  if (!id) {
    console.error("No existing account has that email. Create your owner account through signup, confirm you can sign in, then rerun this command. Admin access remains locked.");
    process.exitCode = 1;
  } else {
    const envPath = new URL("../.env.local", import.meta.url);
    let contents;
    try { contents = await readFile(envPath, "utf8"); }
    catch (error) { if (error?.code === "ENOENT") contents = ""; else throw error; }
    const values = { ARCUS_ADMIN_EMAIL: email, ARCUS_ADMIN_ACCOUNT_ID: id };
    for (const [key, value] of Object.entries(values)) {
      const pattern = new RegExp(`^\\s*(?:export\\s+)?${key}\\s*=.*$`, "gm");
      if (pattern.test(contents)) contents = contents.replace(pattern, () => `${key}=${value}`);
      else contents += `${contents.endsWith("\n") || !contents ? "" : "\n"}${key}=${value}\n`;
    }
    await writeFile(envPath, contents, "utf8");
    console.log("Owner email and immutable account ID saved to ignored .env.local. Restart the app to use them. No database permissions or records were changed.");
  }
} catch {
  console.error("Could not configure owner access. Check the Portways connection and try the command again when available; no automatic retries were made.");
  process.exitCode = 1;
} finally { await pool.end(); }

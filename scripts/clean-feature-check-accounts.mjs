import { loadPortwaysEnv } from "./portways-env.mjs";
import { createPortwaysPool } from "../src/lib/db/portways-pool.mjs";
await loadPortwaysEnv();
const pool=createPortwaysPool({max:1});
try {
 const {rows}=await pool.query("select id,username_normalized from public.arcus_accounts where username_normalized ~ '^feature_check_[0-9a-f]{8}$' and display_name='Disposable feature check' and created_at>now()-interval '1 hour'");
 for(const row of rows)await pool.query("delete from public.arcus_accounts where id=$1 and username_normalized=$2",[row.id,row.username_normalized]);
 console.log(`Removed ${rows.length} disposable feature-check accounts and their data.`);
}finally{await pool.end();}

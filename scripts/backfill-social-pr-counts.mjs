import { detectRecords } from "../src/features/training/logic.ts";

/** Recompute legacy PR counts once from each account's real completed workouts. */
export async function backfillSocialPrCounts(pool) {
  const { rows: accounts } = await pool.query("select distinct account_id from public.arcus_workouts where completed_at is not null");
  for (const { account_id: accountId } of accounts) {
    const { rows } = await pool.query(
      "select id,payload from public.arcus_workouts where account_id=$1 and completed_at is not null order by completed_at,id",
      [accountId],
    );
    const prCounts = new Map(rows.map(row => [row.id, 0]));
    for (const record of detectRecords(rows.map(row => row.payload))) {
      prCounts.set(record.workoutId, (prCounts.get(record.workoutId) ?? 0) + 1);
    }
    const ids = [...prCounts.keys()];
    const counts = ids.map(id => prCounts.get(id) ?? 0);
    if (ids.length) await pool.query(
      `update public.arcus_workouts w set prs_count=v.count
       from unnest($2::uuid[],$3::integer[]) as v(id,count)
       where w.account_id=$1 and w.id=v.id`,
      [accountId, ids, counts],
    );
  }
}

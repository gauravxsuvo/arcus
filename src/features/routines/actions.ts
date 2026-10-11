"use server";

import { z } from "zod";
import { getCurrentAccount } from "@/lib/auth/server";
import { getDatabasePool } from "@/lib/db/pool";

const exerciseSchema = z.object({
  exerciseId: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(200).refine((value) => !/[<>]/.test(value)),
  muscle: z.string().max(100),
  equipment: z.string().max(100),
  sets: z.number().int().min(1).max(20),
  targetReps: z.number().int().min(1).max(1000).nullable(),
  restSeconds: z.number().int().min(0).max(1800),
  setTypes: z.array(z.enum(["working", "warmup", "drop", "failure", "assisted", "paused", "amrap"])).min(1).max(20),
}).refine((exercise) => exercise.sets === exercise.setTypes.length, "Set count must match its saved set tags.");
const routineInputSchema = z.object({
  name: z.string().trim().min(1).max(100).refine((value) => !/[<>]/.test(value), "Use plain text for the routine name."),
  notes: z.string().max(1000).optional().default(""),
  exercises: z.array(exerciseSchema).min(1).max(100),
});
const routineIdSchema = z.string().uuid();
const orderSchema = z.array(routineIdSchema).max(500);

export type RoutineExercise = z.infer<typeof exerciseSchema>;
export type RoutineInput = z.infer<typeof routineInputSchema>;
export type RoutineDTO = RoutineInput & { id: string; sortOrder: number; createdAt: string; updatedAt: string };

type RoutineRow = { id: string; name: string; notes: string; exercises: RoutineExercise[] | string; sort_order: number; created_at: Date | string; updated_at: Date | string };

function toRoutine(row: RoutineRow): RoutineDTO {
  let exercises: RoutineExercise[];
  try { exercises = typeof row.exercises === "string" ? JSON.parse(row.exercises) as RoutineExercise[] : row.exercises; }
  catch { exercises = []; }
  return {
    id: row.id,
    name: row.name,
    notes: row.notes,
    exercises: Array.isArray(exercises) ? exercises : [],
    sortOrder: Number(row.sort_order),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

export async function listRoutines(): Promise<RoutineDTO[]> {
  const account = await getCurrentAccount();
  if (!account) throw new Error("Sign in to view your saved routines.");
  const result = await getDatabasePool().query<RoutineRow>(
    `select id, name, notes, exercises, sort_order, created_at, updated_at
       from public.arcus_routines where account_id = $1
      order by sort_order, created_at desc limit 200`, [account.id],
  );
  return result.rows.map(toRoutine);
}

export async function saveWorkoutAsRoutine(input: unknown): Promise<{ status: "saved"; routine: RoutineDTO } | { status: "pro_required" }> {
  const account = await getCurrentAccount();
  if (!account) throw new Error("Sign in to save a routine.");
  const data = routineInputSchema.parse(input);
  const pool = getDatabasePool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const owner = await client.query<{ is_pro: boolean }>("select is_pro from public.arcus_accounts where id=$1 for update", [account.id]);
    if (!owner.rows[0]) throw new Error("Account not found.");
    const count = await client.query<{ count: number | string }>("select count(*)::int as count from public.arcus_routines where account_id=$1", [account.id]);
    if (!owner.rows[0].is_pro && Number(count.rows[0]?.count ?? 0) >= 4) {
      await client.query("rollback");
      return { status: "pro_required" };
    }
    const now = new Date().toISOString();
    const inserted = await client.query<RoutineRow>(
      `insert into public.arcus_routines (id, account_id, name, notes, exercises, sort_order, created_at, updated_at)
       values (gen_random_uuid(), $1, $2, $3, $4::jsonb, $5, $6, $6)
       returning id, name, notes, exercises, sort_order, created_at, updated_at`,
      [account.id, data.name, data.notes, JSON.stringify(data.exercises), Number(count.rows[0]?.count ?? 0), now],
    );
    await client.query("commit");
    return { status: "saved", routine: toRoutine(inserted.rows[0]) };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function updateRoutine(id: string, input: unknown): Promise<RoutineDTO> {
  const account = await getCurrentAccount();
  if (!account) throw new Error("Sign in to edit routines.");
  const routineId = routineIdSchema.parse(id);
  const data = routineInputSchema.parse(input);
  const result = await getDatabasePool().query<RoutineRow>(
    `update public.arcus_routines set name=$3, notes=$4, exercises=$5::jsonb, updated_at=now()
      where id=$1 and account_id=$2
      returning id, name, notes, exercises, sort_order, created_at, updated_at`,
    [routineId, account.id, data.name, data.notes, JSON.stringify(data.exercises)],
  );
  if (!result.rows[0]) throw new Error("Routine not found.");
  return toRoutine(result.rows[0]);
}

export async function deleteRoutine(id: string): Promise<void> {
  const account = await getCurrentAccount();
  if (!account) throw new Error("Sign in to delete routines.");
  const routineId = routineIdSchema.parse(id);
  const result = await getDatabasePool().query("delete from public.arcus_routines where id=$1 and account_id=$2", [routineId, account.id]);
  if (result.rowCount !== 1) throw new Error("Routine not found.");
}

export async function reorderRoutines(ids: string[]): Promise<void> {
  const account = await getCurrentAccount();
  if (!account) throw new Error("Sign in to reorder routines.");
  const order = orderSchema.parse(ids);
  if (new Set(order).size !== order.length) throw new Error("Routine order contains duplicate IDs.");
  const pool = getDatabasePool();
  const client = await pool.connect();
  try {
    await client.query("begin");
    const owned = await client.query<{ id: string }>("select id from public.arcus_routines where account_id=$1 for update", [account.id]);
    if (owned.rows.length !== order.length || order.some((id) => !owned.rows.some((row) => row.id === id))) throw new Error("Routine list changed. Refresh and try again.");
    if (order.length) await client.query(
      `update public.arcus_routines r set sort_order=ordered.position::int-1, updated_at=now()
         from unnest($2::uuid[]) with ordinality as ordered(id, position)
        where r.id=ordered.id and r.account_id=$1`,
      [account.id, order],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally { client.release(); }
}

export async function startRoutine(id: string): Promise<{ routine: RoutineDTO; previous: Record<string, { weight: number | null; reps: number | null }> }> {
  const account = await getCurrentAccount();
  if (!account) throw new Error("Sign in to start a saved routine.");
  const routineId = routineIdSchema.parse(id);
  const result = await getDatabasePool().query<RoutineRow>(
    `select id, name, notes, exercises, sort_order, created_at, updated_at
       from public.arcus_routines where id=$1 and account_id=$2`, [routineId, account.id],
  );
  const row = result.rows[0];
  if (!row) throw new Error("Routine not found.");
  const routine = toRoutine(row);
  const workouts = await getDatabasePool().query<{ payload: unknown }>(
    `select payload from public.arcus_workouts where account_id=$1 and payload->>'status'='completed'
      order by (payload->>'completedAt')::timestamptz desc limit 50`, [account.id],
  );
  const previous: Record<string, { weight: number | null; reps: number | null }> = {};
  for (const { payload } of workouts.rows) {
    const workout = typeof payload === "string" ? JSON.parse(payload) as { exercises?: Array<{ exerciseId?: string; sets?: Array<{ completed?: boolean; setType?: string; weight?: number | null; reps?: number | null }> }> } : payload as { exercises?: Array<{ exerciseId?: string; sets?: Array<{ completed?: boolean; setType?: string; weight?: number | null; reps?: number | null }> }> };
    for (const exercise of workout.exercises ?? []) {
      const exerciseId = exercise.exerciseId;
      if (!exerciseId || previous[exerciseId]) continue;
      const set = exercise.sets?.find((item) => item.completed && item.setType !== "warmup" && item.weight != null && item.reps != null);
      if (set) previous[exerciseId] = { weight: set.weight ?? null, reps: set.reps ?? null };
    }
  }
  return { routine, previous };
}

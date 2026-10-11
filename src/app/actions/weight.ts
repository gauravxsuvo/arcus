"use server";

import { z } from "zod";
import { getCurrentAccount } from "@/lib/auth/server";
import { getDatabasePool } from "@/lib/db/pool";

const weightLogSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  weight: z.number().finite().min(20).max(1100),
  unit: z.enum(["kg", "lbs"]),
  notes: z.string().trim().max(300).optional().nullable(),
}).refine((value) => value.unit !== "kg" || value.weight <= 500, { message: "Weight must be 500 kg or less." });

export async function saveWeightLogAction(input: unknown): Promise<{ ok: true; log: { date: string; weight: number; unit: "kg" | "lbs"; notes: string | null; updatedAt: string } } | { ok: false; error: string }> {
  const account = await getCurrentAccount();
  if (!account) return { ok: false, error: "Sign in to save a private weigh-in." };
  const parsed = weightLogSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter a valid weight, date, and unit." };
  const date = new Date(`${parsed.data.date}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== parsed.data.date || (parsed.data.unit === "lbs" && parsed.data.weight > 1100)) return { ok: false, error: "Enter a valid weight, date, and unit." };
  try {
    const { date: dateKey, weight, unit, notes } = parsed.data;
    const result = await getDatabasePool().query(
      `insert into public.arcus_weight_logs (account_id, date, weight, unit, notes)
       values ($1, $2, $3, $4, $5)
       on conflict (account_id, date) do update set weight = excluded.weight, unit = excluded.unit,
         notes = excluded.notes, updated_at = now()
       returning date, weight, unit, notes, updated_at`,
      [account.id, dateKey, weight, unit, notes || null],
    );
    const row = result.rows[0];
    return { ok: true, log: { date: row.date, weight: Number(row.weight), unit: row.unit, notes: row.notes, updatedAt: new Date(row.updated_at).toISOString() } };
  } catch {
    return { ok: false, error: "Could not save your weigh-in." };
  }
}

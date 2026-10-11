import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAccountFromRequest } from "@/lib/auth/server";
import { getDatabasePool } from "@/lib/db/pool";
import { calculateReadiness, type SleepQuality } from "@/features/recovery/readiness-engine";

const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
const saveSchema = z.object({
  date: z.string().regex(dayPattern),
  bedtime: z.string().datetime({ offset: true }),
  wakeTime: z.string().datetime({ offset: true }),
  qualityRating: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  timezoneOffsetMinutes: z.number().int().min(-840).max(840),
  tags: z.array(z.enum(["LATE_CAFFEINE", "SORENESS", "LATE_MEAL", "MELATONIN", "RESTLESS"])).max(5),
  notes: z.string().trim().max(500).optional().default(""),
}).strict();

type SleepRow = {
  id: string;
  date: string;
  bedtime: string | Date;
  wake_time: string | Date;
  duration_minutes: number;
  quality_rating: SleepQuality;
  readiness_score: number;
  tags: string[];
  notes: string | null;
  created_at: string | Date;
};

function serialize(row: SleepRow) {
  return {
    id: row.id,
    date: row.date,
    bedtime: new Date(row.bedtime).toISOString(),
    wakeTime: new Date(row.wake_time).toISOString(),
    durationMinutes: Number(row.duration_minutes),
    qualityRating: row.quality_rating,
    readinessScore: Number(row.readiness_score),
    tags: row.tags,
    notes: row.notes ?? "",
    createdAt: new Date(row.created_at).toISOString(),
  };
}

function localDay(date: string, offset: number) {
  const value = new Date(`${date}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

async function heavyTrainingInPreviousDay(accountId: string, wakeTime: Date) {
  const result = await getDatabasePool().query<{ payload: unknown }>(
    `select payload from public.arcus_workouts
      where account_id = $1 and payload->>'status' = 'completed'
        and updated_at > $2::timestamptz - interval '24 hours' and updated_at <= $2`,
    [accountId, wakeTime],
  );
  return result.rows.some(({ payload }) => {
    let workout: unknown = payload;
    if (typeof workout === "string") {
      try { workout = JSON.parse(workout) as unknown; } catch { return false; }
    }
    if (!workout || typeof workout !== "object") return false;
    const exercises = (workout as { exercises?: unknown }).exercises;
    if (!Array.isArray(exercises)) return false;
    let volume = 0;
    let hardSet = false;
    for (const exercise of exercises) {
      const exerciseData = exercise && typeof exercise === "object" ? exercise as { sets?: unknown; trackingType?: unknown; muscle?: unknown } : null;
      if (!exerciseData || exerciseData.trackingType === "cardio" || String(exerciseData.muscle ?? "").toLowerCase() === "cardio") continue;
      const sets = exerciseData.sets;
      if (!Array.isArray(sets)) continue;
      for (const set of sets) {
        if (!set || typeof set !== "object") continue;
        const item = set as { completed?: unknown; weight?: unknown; reps?: unknown; rpe?: unknown; setType?: unknown };
        if (item.completed !== true) continue;
        if (item.setType === "warmup") continue;
        const weight = Number(item.weight);
        const reps = Number(item.reps);
        if (Number.isFinite(weight) && weight > 0 && Number.isFinite(reps) && reps > 0) volume += weight * reps;
        if (Number(item.rpe) >= 9) hardSet = true;
      }
    }
    return volume > 8000 || hardSet;
  });
}

export async function GET(request: Request) {
  const account = await getCurrentAccountFromRequest(request);
  if (!account) return NextResponse.json({ error: "Sign in to view sleep and readiness data." }, { status: 401 });
  const requestedDate = new URL(request.url).searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
  const parsedDay = new Date(`${requestedDate}T00:00:00.000Z`);
  if (!dayPattern.test(requestedDate) || Number.isNaN(parsedDay.getTime()) || parsedDay.toISOString().slice(0, 10) !== requestedDate) {
    return NextResponse.json({ error: "Choose a valid calendar date." }, { status: 400 });
  }
  const startDate = localDay(requestedDate, -6);
  const result = await getDatabasePool().query<SleepRow>(
    `select id, date, bedtime, wake_time, duration_minutes, quality_rating, readiness_score, tags, notes, created_at
       from public.arcus_sleep_logs where account_id = $1 and date between $2 and $3 order by date asc`,
    [account.id, startDate, requestedDate],
  );
  const logs = result.rows.map(serialize);
  return NextResponse.json({ today: logs.find((log) => log.date === requestedDate) ?? null, logs });
}

export async function POST(request: Request) {
  const account = await getCurrentAccountFromRequest(request);
  if (!account) return NextResponse.json({ error: "Sign in to save a sleep check-in." }, { status: 401 });

  let input: z.infer<typeof saveSchema>;
  try {
    input = saveSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Check the sleep times, quality, and tags, then try again." }, { status: 400 });
  }
  const bedtime = new Date(input.bedtime);
  const wakeTime = new Date(input.wakeTime);
  const durationMinutes = Math.round((wakeTime.getTime() - bedtime.getTime()) / 60_000);
  const wakeLocalDate = new Date(wakeTime.getTime() - input.timezoneOffsetMinutes * 60_000).toISOString().slice(0, 10);
  if (durationMinutes < 30 || durationMinutes > 24 * 60 || input.date !== wakeLocalDate) {
    return NextResponse.json({ error: "Wake time must be on the selected date and sleep duration must be between 30 minutes and 24 hours." }, { status: 400 });
  }

  const heavyTraining = await heavyTrainingInPreviousDay(account.id, wakeTime);
  const result = calculateReadiness(durationMinutes, input.qualityRating, heavyTraining);
  const saved = await getDatabasePool().query<SleepRow>(
    `insert into public.arcus_sleep_logs (id, account_id, date, bedtime, wake_time, duration_minutes, quality_rating, readiness_score, tags, notes)
     values (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, nullif($9, ''))
     on conflict (account_id, date) do update set bedtime = excluded.bedtime, wake_time = excluded.wake_time,
       duration_minutes = excluded.duration_minutes, quality_rating = excluded.quality_rating,
       readiness_score = excluded.readiness_score, tags = excluded.tags, notes = excluded.notes, updated_at = now()
     returning id, date, bedtime, wake_time, duration_minutes, quality_rating, readiness_score, tags, notes, created_at`,
    [account.id, input.date, bedtime, wakeTime, durationMinutes, input.qualityRating, result.score, input.tags, input.notes],
  );
  return NextResponse.json({ log: serialize(saved.rows[0]), readiness: result }, { status: 200 });
}

import { z } from "zod";
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((v) => { const d = new Date(`${v}T12:00:00Z`); return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10) === v; }, "Enter a valid date.");
const id = z.string().min(1).max(100);
export const profileDetailsSchema = z.object({
  preferences: z.object({ units:z.enum(["metric","imperial"]), defaultRestTimer:z.number().int().min(0).max(1800), theme:z.enum(["dark","light"]), weekStart:z.enum(["monday","sunday"]), effortSystem:z.enum(["rpe","rir"]) }).optional(),
  bodyMetrics: z.object({ weight:z.number().min(20).max(500).nullable(), bodyFat:z.number().min(0).max(60).nullable() }).optional(),
  bodyMetricsHistory:z.array(z.object({id, date, weight:z.number().min(20).max(500),bodyFat:z.number().min(0).max(60).nullable()})).max(1500).optional(),
  dateOfBirth:date.refine((v) => v <= new Date().toISOString().slice(0,10),"Date of birth cannot be in the future.").nullable().optional(),
  targetGoals:z.array(z.object({id,type:z.enum(["bodyweight","lift"]),exerciseId:id.optional(),targetValue:z.number().positive().max(2000),targetReps:z.number().int().min(1).max(100).optional(),targetDate:date,createdAt:z.string().datetime(),startValue:z.number().nonnegative().optional()}).refine((g) => g.type !== "lift" || Boolean(g.exerciseId),"Select an exercise for a lift goal.")).max(30).optional(),
  activeProgram:z.object({programId:id,startDate:date,trainingMaxes:z.record(z.string().max(100),z.number().positive().max(2000)).optional(),scheduleMode:z.enum(["calendar","rotation"]).optional(),nextDayId:id.optional(),nextWorkoutDate:date.optional()}).nullable().optional(),
});

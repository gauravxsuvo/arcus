import { findColumn } from "./mapper.ts";
import { normalizeLabel } from "./normalizer.ts";
import type { HevyRow, ImportIssue } from "./types.ts";

function parseNumber(value: string | undefined) {
  if (!value?.trim()) return null;
  const parsed = Number(value.replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDate(value: string | undefined) {
  if (!value?.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export function mapRow(row: Record<string, string>, headers: string[], rowNumber: number): { row: HevyRow | null; issues: ImportIssue[] } {
  const issues: ImportIssue[] = [];
  const value = (field: Parameters<typeof findColumn>[1]) => { const column = findColumn(headers, field); return column ? row[column] : undefined; };
  const exerciseName = value("exerciseName")?.trim() ?? "";
  const startedAt = parseDate(value("date"));
  if (!exerciseName) issues.push({ rowNumber, issue: "Missing exercise name.", severity: "error" });
  if (!startedAt) issues.push({ rowNumber, issue: "Invalid or missing workout date.", severity: "error" });
  const rawWeight = value("weight");
  const weight = parseNumber(rawWeight);
  if (rawWeight?.trim() && weight === null) issues.push({ rowNumber, issue: "Invalid weight.", severity: "error" });
  const rawReps = value("reps");
  const reps = parseNumber(rawReps);
  if (rawReps?.trim() && (reps === null || !Number.isInteger(reps) || reps < 0)) issues.push({ rowNumber, issue: "Invalid reps.", severity: "error" });
  const headerKeys = headers.map(normalizeLabel);
  const unit = headerKeys.some((key) => key.includes("lb")) ? "lb" : headerKeys.some((key) => key.includes("kg")) ? "kg" : "unknown";
  const workoutName = value("workoutName")?.trim() || "Imported workout";
  const duration = parseNumber(value("duration"));
  const durationSeconds = duration === null ? parseNumber(value("seconds")) : duration * (duration < 600 ? 60 : 1);
  const rpe = parseNumber(value("rpe"));
  if (rpe !== null && (rpe < 0 || rpe > 10)) issues.push({ rowNumber, issue: "RPE must be between 0 and 10.", severity: "error" });
  if (!startedAt || !exerciseName || issues.some((item) => item.severity === "error")) return { row: null, issues };
  return { row: { rowNumber, workoutName, startedAt, durationSeconds, exerciseName, setIndex: Math.max(0, Math.floor(parseNumber(value("setIndex")) ?? 0)), weight, reps, rpe, notes: value("notes")?.trim() ?? "", workoutNotes: value("workoutNotes")?.trim() ?? "", unit }, issues };
}

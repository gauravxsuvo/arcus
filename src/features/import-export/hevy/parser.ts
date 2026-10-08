import type { Exercise } from "../../exercises/catalog";
import { parseCsv } from "../csv.ts";
import { detectFormat, matchExercise } from "./mapper.ts";
import { mapRow } from "./validator.ts";
import type { HevyAnalysis } from "./types.ts";

export async function analyzeHevyCsv(input: string, catalog: Exercise[]): Promise<HevyAnalysis> {
  const table = parseCsv(input);
  const format = detectFormat(table.headers);
  const issues = [];
  const rows = [];
  for (let index = 0; index < table.rows.length; index += 1) {
    const result = mapRow(table.rows[index], table.headers, table.rowNumbers[index]);
    issues.push(...result.issues);
    if (result.row) rows.push(result.row);
  }
  const names = [...new Set(rows.map((row) => row.exerciseName))];
  const matches = names.map((name) => matchExercise(name, catalog));
  const units = new Set(rows.map((row) => row.unit).filter((unit) => unit !== "unknown"));
  const dates = rows.map((row) => row.startedAt).sort();
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  const fileHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return { format, headers: table.headers, rows, issues, matches, unit: units.size > 1 ? "mixed" : [...units][0] ?? "unknown", dateRange: { from: dates[0] ?? null, to: dates.at(-1) ?? null }, workoutCount: new Set(rows.map((row) => `${row.workoutName}|${row.startedAt.slice(0, 16)}`)).size, setCount: rows.length, fileHash };
}

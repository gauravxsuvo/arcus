import test from "node:test";
import assert from "node:assert/strict";
import { escapeCsv, parseCsv, serializeCsv } from "../src/features/import-export/csv.ts";
import { normalizeExerciseName, normalizeLabel } from "../src/features/import-export/hevy/normalizer.ts";
import { analyzeHevyCsv } from "../src/features/import-export/hevy/parser.ts";
import { exerciseCatalog } from "../src/features/exercises/catalog.ts";

test("CSV parser preserves commas, quotes, and newlines", () => {
  const csv = serializeCsv(["Name", "Notes"], [{ Name: "Bench, heavy", Notes: "Line one\nLine two" }, { Name: "Curl", Notes: "She said \"go\"" }]);
  const parsed = parseCsv(csv);
  assert.deepEqual(parsed.headers, ["Name", "Notes"]);
  assert.equal(parsed.rows[0].Name, "Bench, heavy");
  assert.equal(parsed.rows[0].Notes, "Line one\nLine two");
  assert.equal(parsed.rows[1].Notes, 'She said "go"');
});

test("CSV export protects spreadsheet formula values", () => {
  assert.equal(escapeCsv("=SUM(A1:A2)"), "'=SUM(A1:A2)");
  assert.equal(escapeCsv("safe"), "safe");
});

test("CSV parser rejects unclosed fields and duplicate headers", () => {
  assert.throws(() => parseCsv("Name,Notes\nBench,\"not closed"), /unclosed/);
  assert.throws(() => parseCsv("Name,name\nBench,one"), /duplicate/);
});

test("exercise labels normalize deterministically", () => {
  assert.equal(normalizeLabel("Workout Name"), "workout_name");
  assert.equal(normalizeExerciseName("  Romanian-DEADLIFT "), "romanian deadlift");
});

test("HEVY adapter analyzes Strong-style rows without writing data", async () => {
  const csv = [
    "Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE",
    "2026-10-08T08:00:00Z,Upper A,3600,Barbell Bench Press,1,80,8,,,,,8",
    "2026-10-08T08:00:00Z,Upper A,3600,Barbell Bench Press,2,80,7,,,,,9",
  ].join("\n");
  const report = await analyzeHevyCsv(csv, exerciseCatalog);
  assert.equal(report.format, "strong");
  assert.equal(report.workoutCount, 1);
  assert.equal(report.setCount, 2);
  assert.equal(report.matches[0].status, "matched");
  assert.equal(report.issues.length, 0);
});

test("HEVY adapter reports malformed rows instead of guessing", async () => {
  const report = await analyzeHevyCsv("Date,Workout Name,Exercise Name,Weight,Reps\nnot-a-date,Legs,,bad,8", exerciseCatalog);
  assert.equal(report.rows.length, 0);
  assert.ok(report.issues.some((issue) => issue.issue.includes("exercise name")));
  assert.ok(report.issues.some((issue) => issue.issue.includes("date")));
});

import test from "node:test";
import assert from "node:assert/strict";
import { buildExerciseTrend, strengthExerciseOptions } from "../src/features/analytics/chart-data.ts";
import { buildWeeklyVolume } from "../src/features/analytics/engine.ts";

const set = (weight, reps, extra = {}) => ({ id: "set", index: 0, weight, reps, completed: true, completedAt: "2026-10-08T09:00:00Z", rpe: null, ...extra });
const exercise = (sets, extra = {}) => ({ id: "row", exerciseId: "bench", name: "Bench Press", muscle: "Chest", equipment: "Barbell", restSeconds: 90, sets, ...extra });
const workout = (id, date, exercises, extra = {}) => ({ id, name: id, startedAt: date, completedAt: date, status: "completed", exercises, notes: "", restUntil: null, updatedAt: date, ...extra });

test("exercise trend takes the strongest eligible set per session and sorts unsorted history", () => {
  const records = [
    workout("later", "2026-10-08T09:00:00Z", [exercise([set(100, 3)]), exercise([set(95, 6)])]),
    workout("earlier", "2026-10-01T09:00:00Z", [exercise([set(80, 8), set(85, 6)])]),
  ];
  const before = JSON.stringify(records);
  const points = buildExerciseTrend(records, "bench");
  assert.deepEqual(points.map(point => point.id), ["earlier", "later"]);
  assert.equal(points[0].value, 102);
  assert.equal(points[1].value, 114);
  assert.equal(JSON.stringify(records), before);
});

test("strength series excludes unfinished, warm-up, cardio, invalid and unrelated sets", () => {
  const records = [
    workout("valid", "2026-10-08T09:00:00Z", [exercise([set(80, 8), set(200, 1, { setType: "warmup" }), set(300, 1, { completed: false }), set(Infinity, 1), set(100, 1.5)]), exercise([set(999, 1)], { exerciseId: "squat" })]),
    workout("cardio", "2026-10-07T09:00:00Z", [exercise([set(999, 1)], { trackingType: "cardio" })]),
    workout("bad-date", "invalid", [exercise([set(999, 1)])]),
    workout("active", "2026-10-06T09:00:00Z", [exercise([set(999, 1)])], { status: "active" }),
    workout("bodyweight", "2026-10-05T09:00:00Z", [exercise([set(null, 8)])]),
  ];
  const points = buildExerciseTrend(records, "bench");
  assert.equal(points.length, 1);
  assert.equal(points[0].id, "valid");
  assert.ok(Math.abs(points[0].value - 101.3333333) < .0001);
});

test("formula changes recompute 1RM; top weight includes valid higher-rep work", () => {
  const records = [workout("session", "2026-10-08T09:00:00Z", [exercise([set(80, 8), set(90, 15)])])];
  const epley = buildExerciseTrend(records, "bench", "estimated_1rm", "epley")[0].value;
  const brzycki = buildExerciseTrend(records, "bench", "estimated_1rm", "brzycki")[0].value;
  assert.ok(epley > brzycki);
  assert.equal(buildExerciseTrend(records, "bench", "top_weight")[0].value, 90);
  assert.deepEqual(buildExerciseTrend([workout("high-reps", "2026-10-08T09:00:00Z", [exercise([set(90, 15)])])], "bench"), []);
});

test("large histories retain the latest thirty points and match by stable exercise ID", () => {
  const records = Array.from({ length: 45 }, (_, index) => workout(String(index), new Date(2026, 8, index + 1, 9).toISOString(), [exercise([set(80 + index, 1)], { name: index % 2 ? "Renamed lift" : "Bench Press" })]));
  const points = buildExerciseTrend(records.reverse(), "bench");
  assert.equal(points.length, 30);
  assert.equal(points[0].id, "15");
  assert.equal(points.at(-1).id, "44");
});

test("exercise choices deduplicate IDs and exclude movements without valid strength data", () => {
  const records = [workout("session", "2026-10-08T09:00:00Z", [exercise([set(80, 8)]), exercise([set(85, 3)]), exercise([set(1, 8)], { exerciseId: "bike", name: "Bike", muscle: "Cardio" }), exercise([set(null, 8)], { exerciseId: "pullup" })])];
  assert.deepEqual(strengthExerciseOptions(records), [{ id: "bench", name: "Bench Press" }]);
});

test("four calendar weeks preserve zero weeks and working volume while honoring week start", () => {
  const sunday = new Date(2026, 9, 4, 9).toISOString();
  const records = [workout("sunday", sunday, [exercise([set(80, 8), set(200, 1, { setType: "warmup" }), set(300, 1, { completed: false })]), exercise([set(999, 1)], { trackingType: "cardio" })])];
  const now = new Date(2026, 9, 8, 12);
  const mondayWeeks = buildWeeklyVolume(records, 4, now, "monday");
  const sundayWeeks = buildWeeklyVolume(records, 4, now, "sunday");
  assert.deepEqual(mondayWeeks.map(week => week.volume), [0, 0, 640, 0]);
  assert.deepEqual(sundayWeeks.map(week => week.volume), [0, 0, 0, 640]);
  assert.equal(mondayWeeks.reduce((sum, week) => sum + week.sessions, 0), 1);
});

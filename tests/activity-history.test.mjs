import test from "node:test";
import assert from "node:assert/strict";
import { buildWorkoutActivity, calculateStreaks, mergeLocalWorkoutActivity } from "../src/features/training/activity.ts";

const workout = (id, completedAt, name, weight = 100, reps = 5) => ({
  id,
  name,
  startedAt: completedAt,
  completedAt,
  status: "completed",
  notes: "",
  restUntil: null,
  updatedAt: completedAt,
  exercises: [{
    id: `exercise-${id}`,
    exerciseId: "barbell-bench-press",
    name: "Bench Press",
    muscle: "Chest",
    equipment: "Barbell",
    restSeconds: 90,
    sets: [{ id: `set-${id}`, index: 0, weight, reps, rpe: null, completed: true, completedAt }],
  }],
});

test("activity aggregation uses UTC dates, counts completed sessions, and marks improving PR days", () => {
  const sessions = [
    workout("one", "2026-10-04T22:30:00.000Z", "Push", 100, 5),
    workout("two", "2026-10-05T00:15:00.000Z", "Upper", 110, 5),
  ];
  const days = buildWorkoutActivity(sessions, 2026);
  assert.equal(days[0].date, "2026-10-04");
  assert.equal(days[0].totalVolume, 500);
  assert.deepEqual(days[0].workoutIds, ["one"]);
  assert.equal(days[1].isPersonalRecord, true);
});

test("weekly streak counts consecutive workout weeks and year totals", () => {
  const days = buildWorkoutActivity([
    workout("one", "2026-10-04T18:00:00.000Z", "Push"),
    workout("two", "2026-10-10T18:00:00.000Z", "Pull"),
  ], 2026);
  assert.deepEqual(calculateStreaks(days, new Date("2026-10-11T12:00:00.000Z")), {
    currentWeeklyStreak: 2,
    totalWorkouts: 2,
    totalVolume: 1000,
    activeWeeks: 2,
    elapsedWeeks: 41,
  });
});

test("database activity keeps local completed workouts that have not synced", () => {
  const remote = [{ date: "2026-10-04", count: 1, totalVolume: 500, titles: ["Push"], workoutIds: ["one"] }];
  const merged = mergeLocalWorkoutActivity(remote, [
    workout("one", "2026-10-04T18:00:00.000Z", "Push"),
    workout("two", "2026-10-04T20:00:00.000Z", "Pull"),
  ], 2026);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].count, 2);
  assert.equal(merged[0].totalVolume, 1000);
  assert.deepEqual(merged[0].workoutIds, ["one", "two"]);
});

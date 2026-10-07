import test from "node:test";
import assert from "node:assert/strict";
import { estimateOneRepMax, findPersonalRecords, recommendNextLoad } from "../src/features/analytics/engine.ts";

test("Epley estimate returns the tested load for one rep and estimates rep sets", () => {
  assert.equal(estimateOneRepMax(100, 1), 100);
  assert.equal(estimateOneRepMax(90, 10), 120);
  assert.equal(estimateOneRepMax(90, 13), 0);
});

test("PR history records improving estimated one rep maxes in date order", () => {
  const makeWorkout = (id, date, weight, reps) => ({
    id, name: id, startedAt: date, completedAt: date, status: "completed", notes: "", restUntil: null, updatedAt: date,
    exercises: [{ id: `row-${id}`, exerciseId: "squat", name: "Squat", muscle: "Quads", equipment: "Barbell", restSeconds: 120,
      sets: [{ id: `set-${id}`, index: 0, weight, reps, rpe: null, completed: true, completedAt: date }] }],
  });
  const records = findPersonalRecords([
    makeWorkout("later", "2026-09-02T10:00:00.000Z", 80, 8),
    makeWorkout("first", "2026-09-01T10:00:00.000Z", 80, 6),
  ]);
  assert.equal(records.length, 2);
  assert.equal(records[0].workoutId, "later");
  assert.ok(records[0].estimatedOneRepMax > records[1].estimatedOneRepMax);
});

test("double progression holds load until all sets meet the rep target", () => {
  const exercise = { id: "row", exerciseId: "press", name: "Press", muscle: "Chest", equipment: "Barbell", restSeconds: 90,
    sets: [
      { id: "a", index: 0, weight: 60, reps: 12, rpe: 8, completed: true },
      { id: "b", index: 1, weight: 60, reps: 12, rpe: 9, completed: true },
    ] };
  assert.equal(recommendNextLoad(exercise).load, 62.5);
  exercise.sets[1].reps = 10;
  assert.equal(recommendNextLoad(exercise).load, 60);
});

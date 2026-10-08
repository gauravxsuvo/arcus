import test from "node:test";
import assert from "node:assert/strict";
import { fillNextBlankSet, lastWorkingMeasurements, previousExercises, previousMatchingSet } from "../src/features/workouts/set-assistance.ts";

const set = (id, extra = {}) => ({ id, index: 0, weight: null, reps: null, rpe: null, completed: false, completedAt: null, ...extra });
const exercise = (sets, extra = {}) => ({ id: "row", exerciseId: "bench", name: "Bench", muscle: "Chest", equipment: "Barbell", restSeconds: 90, sets, ...extra });
const logged = set("source", { weight: 75.5, reps: 8, rpe: 9, rir: 1, completed: true, completedAt: "2026-10-08T09:00:00Z" });

test("auto-fill copies fractional load/reps to only the next blank set without copying effort or completion", () => {
  const original = exercise([logged, set("next"), set("later")]);
  const before = JSON.stringify(original);
  const result = fillNextBlankSet(original, "source");
  assert.equal(result.filledId, "next");
  assert.deepEqual(result.exercise.sets[1], { ...set("next"), weight: 75.5, reps: 8 });
  assert.equal(result.exercise.sets[2].weight, null);
  assert.equal(JSON.stringify(original), before);
});

test("auto-fill preserves planned, partially edited and completed targets", () => {
  for (const target of [set("next", { weight: 80 }), set("next", { reps: 12 }), set("next", { completed: true }), set("next", { weight: 0 })]) {
    const original = exercise([logged, target]);
    assert.equal(fillNextBlankSet(original, "source").exercise, original);
  }
});

test("warm-up and special-set boundaries never inherit working values", () => {
  for (const type of ["warmup", "drop", "failure", "amrap"]) {
    assert.equal(fillNextBlankSet(exercise([{ ...logged, setType: type }, set("next")]), "source").filledId, null);
    assert.equal(fillNextBlankSet(exercise([logged, set("next", { setType: type })]), "source").filledId, null);
  }
  assert.equal(fillNextBlankSet(exercise([{ ...logged, completed: false }, set("next")]), "source").filledId, null);
  assert.equal(fillNextBlankSet(exercise([{ ...logged, reps: 1.5 }, set("next")]), "source").filledId, null);
  assert.equal(fillNextBlankSet(exercise([logged]), "missing").filledId, null);
});

test("bodyweight and cardio measurements copy without fabricating a load", () => {
  const bodyweight = fillNextBlankSet(exercise([{ ...logged, weight: null }, set("next")]), "source");
  assert.equal(bodyweight.exercise.sets[1].weight, null);
  assert.equal(bodyweight.exercise.sets[1].reps, 8);
  const bike = exercise([set("source", { completed: true, distanceKm: 2.5, durationSeconds: 150, rpe: 8 }), set("next")], { trackingType: "cardio", muscle: "Cardio" });
  const result = fillNextBlankSet(bike, "source").exercise.sets[1];
  assert.equal(result.distanceKm, 2.5); assert.equal(result.durationSeconds, 150); assert.equal(result.weight, null); assert.equal(result.rpe, null);
});

test("new sets use the last valid completed working set, skipping later warm-ups and unfinished rows", () => {
  assert.deepEqual(lastWorkingMeasurements(exercise([logged, set("warmup", { ...logged, weight: 40, setType: "warmup" }), set("unfinished", { weight: 100, reps: 3 })])), { weight: 75.5, reps: 8 });
});

test("previous session uses date order and completed data, never input/import order", () => {
  const history = [
    { id: "old", status: "completed", completedAt: "2026-09-01T09:00:00Z", exercises: [exercise([{ ...logged, weight: 60 }])] },
    { id: "active", status: "active", completedAt: "2026-10-09T09:00:00Z", exercises: [exercise([{ ...logged, weight: 999 }])] },
    { id: "recent", status: "completed", completedAt: "2026-10-01T09:00:00Z", exercises: [exercise([logged])] },
    { id: "invalid", status: "completed", completedAt: "invalid", exercises: [exercise([logged])] },
  ];
  const before = JSON.stringify(history);
  assert.equal(previousExercises(history).get("bench").sets[0].weight, 75.5);
  assert.equal(JSON.stringify(history), before);
});

test("previous rows match ordinal within set type, so new warm-ups cannot shift working comparisons", () => {
  const previous = exercise([set("pw", { ...logged, weight: 30, setType: "warmup" }), { ...logged, id: "p1", weight: 70 }, { ...logged, id: "p2", weight: 75 }]);
  const current = exercise([set("w1", { setType: "warmup" }), set("w2", { setType: "warmup" }), set("first"), set("second"), set("third")]);
  assert.equal(previousMatchingSet(current, "first", previous).weight, 70);
  assert.equal(previousMatchingSet(current, "second", previous).weight, 75);
  assert.equal(previousMatchingSet(current, "w1", previous).weight, 30);
  assert.equal(previousMatchingSet(current, "w2", previous), null);
  assert.equal(previousMatchingSet(current, "third", previous), null);
});

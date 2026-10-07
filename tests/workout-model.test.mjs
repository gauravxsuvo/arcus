import test from "node:test";
import assert from "node:assert/strict";
import { calculateWorkoutTotals } from "../src/features/workouts/model.ts";

const session = {
  id: "session",
  name: "Push",
  startedAt: "2026-10-03T10:00:00.000Z",
  completedAt: "2026-10-03T11:07:00.000Z",
  status: "completed",
  exercises: [{
    id: "exercise-row",
    exerciseId: "bench",
    name: "Bench press",
    muscle: "Chest",
    equipment: "Barbell",
    restSeconds: 120,
    sets: [
      { id: "set-1", index: 0, weight: 70, reps: 8, rpe: 8, completed: true, completedAt: null },
      { id: "set-2", index: 1, weight: 70, reps: 7, rpe: 9, completed: true, completedAt: null },
      { id: "set-3", index: 2, weight: 70, reps: 6, rpe: null, completed: false, completedAt: null },
    ],
  }],
  notes: "",
  restUntil: null,
  updatedAt: "2026-10-03T11:07:00.000Z",
};

test("workout totals include only completed sets", () => {
  assert.deepEqual(calculateWorkoutTotals(session), { sets: 2, reps: 15, volume: 1050, durationSeconds: 4020 });
});

test("workout volume is zero when completed sets have no load or reps", () => {
  const emptyLoad = structuredClone(session);
  emptyLoad.exercises[0].sets[0] = { ...emptyLoad.exercises[0].sets[0], weight: null, reps: null };
  emptyLoad.exercises[0].sets[1].completed = false;
  assert.equal(calculateWorkoutTotals(emptyLoad).volume, 0);
});

test("duration is clamped at zero for invalid timestamp order", () => {
  const invalidDuration = { ...session, completedAt: "2026-10-03T09:00:00.000Z" };
  assert.equal(calculateWorkoutTotals(invalidDuration).durationSeconds, 0);
});

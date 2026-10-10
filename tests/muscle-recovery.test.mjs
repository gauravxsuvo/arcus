import test from "node:test";
import assert from "node:assert/strict";
import { muscleRecovery } from "../src/features/training/muscle-recovery.ts";

const workout = (startedAt, exercises, completedAt = startedAt) => ({
  id: crypto.randomUUID(), name: "Training", startedAt, completedAt, status: "completed",
  exercises, notes: "", restUntil: null, updatedAt: completedAt,
});
const exercise = (muscle, completedAt, setType = "working") => ({
  id: crypto.randomUUID(), exerciseId: muscle, name: muscle, muscle, equipment: "Barbell", restSeconds: 90,
  sets: [{ id: crypto.randomUUID(), index: 0, weight: 20, reps: 8, rpe: 8, completed: true, completedAt, setType }],
});

test("muscle recovery uses completed working sets and a transparent 48 hour threshold", () => {
  const now = new Date("2026-10-09T12:00:00.000Z");
  const workouts = [
    workout("2026-10-09T10:00:00.000Z", [exercise("Chest", "2026-10-09T10:00:00.000Z")]),
    workout("2026-10-05T10:00:00.000Z", [exercise("Back", "2026-10-05T10:00:00.000Z")]),
    workout("2026-10-09T11:00:00.000Z", [exercise("Legs", "2026-10-09T11:00:00.000Z", "warmup")]),
  ];
  const result = muscleRecovery(workouts, now);
  assert.deepEqual(result.map(({ muscle, status, workingSetsLast7Days }) => [muscle, status, workingSetsLast7Days]), [
    ["Chest", "recovering", 1], ["Back", "ready", 1],
  ]);
});

test("cardio and future-dated sets do not count as muscle recovery load", () => {
  const now = new Date("2026-10-09T12:00:00.000Z");
  const cardio = { ...exercise("Cardio", "2026-10-09T10:00:00.000Z"), trackingType: "cardio" };
  const future = exercise("Shoulders", "2026-10-10T10:00:00.000Z");
  assert.deepEqual(muscleRecovery([workout("2026-10-09T10:00:00.000Z", [cardio, future])], now), []);
});

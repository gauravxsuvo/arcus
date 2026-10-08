import test from "node:test";
import assert from "node:assert/strict";
import { generateWarmupSets } from "../src/features/workouts/warmup.ts";

test("warm-up generation creates ascending, uncompleted sets", () => {
  const sets = generateWarmupSets(100);
  assert.deepEqual(sets.map((set) => set.weight), [40, 60, 75, 85]);
  assert.deepEqual(sets.map((set) => set.reps), [10, 8, 5, 3]);
  assert.ok(sets.every((set) => set.setType === "warmup" && !set.completed));
});

test("warm-up generation returns nothing without a working weight", () => {
  assert.deepEqual(generateWarmupSets(0), []);
});

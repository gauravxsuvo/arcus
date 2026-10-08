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

test("warm-ups never exceed the working load and reject invalid increments", () => {
  assert.deepEqual(generateWarmupSets(1), []);
  for (const increment of [0, -1, Infinity, NaN]) assert.deepEqual(generateWarmupSets(100, increment), []);
  const sets = generateWarmupSets(5);
  assert.ok(sets.every(set => set.weight > 0 && set.weight < 5));
  assert.deepEqual(sets.map(set => set.index), sets.map((_, index) => index));
});

test("imperial ramps follow five-pound steps while storing kilograms", () => {
  const factor = 2.2046226218;
  const sets = generateWarmupSets(315 / factor, 5 / factor);
  assert.deepEqual(sets.map(set => Math.round(set.weight * factor)), [125, 190, 235, 270]);
});

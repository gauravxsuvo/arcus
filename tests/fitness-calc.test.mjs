import test from "node:test";
import assert from "node:assert/strict";
import { calculateOneRepMax } from "../src/lib/fitness-calc.ts";
import { calculatePlates } from "../src/lib/plate-calculator.ts";

test("Brzycki estimate is exact for one rep and valid through twelve reps", () => {
  assert.equal(calculateOneRepMax(100, 1), 100);
  assert.equal(calculateOneRepMax(100, 12), 144);
  assert.equal(calculateOneRepMax(100, 13), null);
  assert.equal(calculateOneRepMax(100, 0), null);
  assert.equal(calculateOneRepMax(0, 5), null);
});

test("plate calculator gives the exact per-side load for a standard bar", () => {
  assert.deepEqual(calculatePlates(100), {
    platesPerSide: [{ weight: 25, count: 1 }, { weight: 15, count: 1 }],
    achievableWeight: 100,
    isExact: true,
  });
});

test("plate calculator chooses the closest load below an unreachable target", () => {
  const result = calculatePlates(101, 20, "kg");
  assert.equal(result.achievableWeight, 100);
  assert.equal(result.isExact, false);
  assert.deepEqual(result.platesPerSide, [{ weight: 25, count: 1 }, { weight: 15, count: 1 }]);
});

test("plate calculator supports pounds and alternate bar weights", () => {
  const result = calculatePlates(135, 45, "lbs");
  assert.equal(result.achievableWeight, 135);
  assert.deepEqual(result.platesPerSide, [{ weight: 45, count: 1 }]);
});

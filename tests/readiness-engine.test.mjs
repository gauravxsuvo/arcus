import test from "node:test";
import assert from "node:assert/strict";
import { calculateReadiness } from "../src/features/recovery/readiness-engine.ts";

test("readiness caps duration points and maps high recovery to optimal", () => {
  const result = calculateReadiness(600, 3, false);
  assert.equal(result.score, 100);
  assert.equal(result.status, "optimal");
});

test("heavy training adjusts short sleep and returns low-recovery advice", () => {
  const result = calculateReadiness(300, 1, true);
  assert.equal(result.score, 38);
  assert.equal(result.status, "low");
  assert.match(result.recommendation, /auto-regulate/i);
});

test("seven hours with a decent quality rating is moderate", () => {
  const result = calculateReadiness(420, 2, false);
  assert.equal(result.score, 78);
  assert.equal(result.status, "moderate");
});

test("invalid durations and targets are rejected", () => {
  assert.throws(() => calculateReadiness(-1, 2, false), RangeError);
  assert.throws(() => calculateReadiness(400, 2, false, 0), RangeError);
});

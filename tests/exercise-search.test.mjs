import test from "node:test";
import assert from "node:assert/strict";
import { searchExercises, exerciseCatalog } from "../src/features/exercises/catalog.ts";

test("exercise lookup is case insensitive and matches partial names", () => {
  assert.ok(searchExercises("BENCH").some((exercise) => exercise.name === "Barbell Bench Press"));
});

test("exercise lookup matches deterministic aliases", () => {
  const matches = searchExercises("rdl");
  assert.ok(matches.some((exercise) => exercise.id === "romanian-deadlift"));
});

test("empty search returns the complete built-in catalog", () => {
  assert.equal(searchExercises("").length, exerciseCatalog.length);
  assert.ok(exerciseCatalog.length>=80);
  assert.equal(new Set(exerciseCatalog.map(e=>e.id)).size,exerciseCatalog.length);
});

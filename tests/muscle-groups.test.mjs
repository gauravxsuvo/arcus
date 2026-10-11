import test from "node:test";
import assert from "node:assert/strict";
import { exerciseCatalog } from "../src/features/exercises/catalog.ts";
import { findUnmappedCatalogExercises, getExerciseMuscleTargets, getMuscleFatigue } from "../src/features/recovery/muscle-groups.ts";

test("all strength catalog movements map to a primary anatomy group", () => {
  assert.deepEqual(findUnmappedCatalogExercises().map((exercise) => exercise.id), []);
  assert.ok(exerciseCatalog.filter((exercise) => exercise.muscle !== "Cardio").every((exercise) => exercise.primaryMuscles?.length));
});

test("catalog targets normalize display labels and preserve secondary targets", () => {
  assert.deepEqual(getExerciseMuscleTargets(exerciseCatalog.find((exercise) => exercise.id === "barbell-bench-press")), { primary: "chest", secondary: ["shoulders", "triceps"] });
  assert.equal(getExerciseMuscleTargets(exerciseCatalog.find((exercise) => exercise.id === "power-clean")).primary, "quads");
});

test("fatigue windows use the requested 24, 48, and 72 hour boundaries", () => {
  assert.equal(getMuscleFatigue(0), "high");
  assert.equal(getMuscleFatigue(24), "medium");
  assert.equal(getMuscleFatigue(48), "nearly-recovered");
  assert.equal(getMuscleFatigue(72), "fresh");
  assert.equal(getMuscleFatigue(null), "fresh");
});

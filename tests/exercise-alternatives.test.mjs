import test from "node:test";
import assert from "node:assert/strict";
import { findExerciseAlternatives } from "../src/features/exercises/alternatives.ts";

test("exercise alternatives prioritize movement pattern and muscle", () => {
  const source = { id: "bench", name: "Bench", muscle: "Chest", equipment: "Barbell", pattern: "Horizontal push", aliases: [], restSeconds: 120 };
  const alternatives = findExerciseAlternatives(source, [source,
    { ...source, id: "db", name: "Dumbbell Bench", equipment: "Dumbbell" },
    { ...source, id: "row", name: "Cable Row", muscle: "Back", pattern: "Horizontal pull" },
  ]);
  assert.equal(alternatives[0].exercise.id, "db");
  assert.match(alternatives[0].reason, /movement|muscle/i);
});

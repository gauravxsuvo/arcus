import test from "node:test";
import assert from "node:assert/strict";
import { removeSetFromExercise, restoreRemovedSet, shouldDeleteSwipedSet, shouldDuplicateSwipedSet } from "../src/features/workouts/set-deletion.ts";

const set = (id, index, values = {}) => ({ id, index, weight: 80, reps: 8, rpe: 8, completed: true, completedAt: "2026-10-08T10:00:00Z", setType: "working", ...values });
const exercise = () => ({ id: "instance", exerciseId: "bench", name: "Bench", muscle: "Chest", equipment: "Barbell", restSeconds: 90, sets: [set("a", 0), set("b", 1), set("c", 2)] });

test("only sufficient actual left displacement deletes; short/right/invalid swipes do not", () => {
  for (const x of [0, 50, -5, -74.99, NaN, Infinity, -Infinity]) assert.equal(shouldDeleteSwipedSet(x), false);
  for (const x of [-75, -85, -100]) assert.equal(shouldDeleteSwipedSet(x), true);
});

test("only sufficient actual right displacement duplicates; short/left/invalid swipes do not", () => {
  for (const x of [0, -50, 5, 74.99, NaN, Infinity, -Infinity]) assert.equal(shouldDuplicateSwipedSet(x), false);
  for (const x of [75, 85, 100]) assert.equal(shouldDuplicateSwipedSet(x), true);
});

test("removal keeps at least one set and ignores stale or unknown IDs", () => {
  const source = exercise();
  assert.deepEqual(removeSetFromExercise(source, "missing"), { exercise: source, removed: null });
  const single = { ...source, sets: [source.sets[0]] };
  assert.deepEqual(removeSetFromExercise(single, "a"), { exercise: single, removed: null });
});

test("deletion and undo preserve measurements/effort/completion and reindex without mutating source", () => {
  const source = exercise();
  const result = removeSetFromExercise(source, "b");
  assert.deepEqual(result.exercise.sets.map(s => [s.id, s.index]), [["a", 0], ["c", 1]]);
  assert.deepEqual(restoreRemovedSet(result.exercise, result.removed), source);
  assert.equal(source.sets.length, 3);
  assert.notEqual(result.removed.set, source.sets[1]);
});

test("undo restores only the removed set and preserves intervening edits/additions", () => {
  const result = removeSetFromExercise(exercise(), "b");
  const changed = { ...result.exercise, restSeconds: 120, notes: "Updated", sets: [{ ...result.exercise.sets[0], weight: 90, reps: 10 }, result.exercise.sets[1], set("new", 2, { completed: false })] };
  const restored = restoreRemovedSet(changed, result.removed);
  assert.deepEqual(restored.sets.map(s => s.id), ["a", "b", "c", "new"]);
  assert.equal(restored.sets[0].weight, 90);
  assert.equal(restored.sets[0].reps, 10);
  assert.equal(restored.restSeconds, 120);
  assert.equal(restored.notes, "Updated");
  assert.equal(restoreRemovedSet(restored, result.removed), restored);
});

test("undo uses surviving neighboring IDs after reordering and bounds the index if both disappear", () => {
  const result = removeSetFromExercise(exercise(), "b");
  const reordered = { ...result.exercise, sets: [set("c", 0), set("a", 1)] };
  assert.deepEqual(restoreRemovedSet(reordered, result.removed).sets.map(s => s.id), ["b", "c", "a"]);
  const unrelated = { ...result.exercise, sets: [set("new", 0)] };
  assert.deepEqual(restoreRemovedSet(unrelated, result.removed).sets.map(s => [s.id, s.index]), [["new", 0], ["b", 1]]);
});

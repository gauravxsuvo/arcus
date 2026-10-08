import test from "node:test";
import assert from "node:assert/strict";
import { parseWorkoutDuration, formatWorkoutDuration, toLocalDateTimeInput, fromLocalDateTimeInput, prepareCompletedWorkoutEdit } from "../src/features/workouts/edit.ts";
import { parseBackup, workoutSchema } from "../src/features/import-export/restore-schema.ts";
import { calculateWorkoutTotals, MAX_WORKOUT_MEDIA_DATA_LENGTH } from "../src/features/workouts/model.ts";
import { calculateEstimatedBest, calculateMuscleVolume, findPersonalRecords, getCompletedSets, recommendNextLoad } from "../src/features/analytics/engine.ts";
import { detectRecords } from "../src/features/training/logic.ts";

const start = "2026-10-08T05:15:00.000Z";
const now = "2026-10-09T10:00:00.000Z";
function session() {
  return {
    id: "workout-one", name: "  Upper day  ", startedAt: start, completedAt: "2026-10-08T06:25:00.000Z",
    status: "completed", notes: "Good session\nLast set was tough.", location: "  My gym  ",
    tags: ["Great Session"], programId: "program-one", programDay: "Upper A",
    importSource: "hevy", importBatchId: "batch-one", sourceFingerprint: "fingerprint-one",
    restUntil: "2026-10-08T06:27:00.000Z", syncStatus: "synced", updatedAt: start,
    exercises: [{
      id: "bench-row", exerciseId: "bench", name: "Bench press", muscle: "Chest", equipment: "Barbell",
      restSeconds: 90, groupId: "group-one", notes: "Controlled pause", trackingType: "strength",
      sets: [
        { id: "bench-set-one", index: 7, weight: 80, reps: 8, rpe: 8, rir: 2, completed: true, completedAt: null, setType: "working" },
        { id: "bench-set-two", index: 9, weight: 80, reps: 6, rpe: null, completed: false, completedAt: start },
      ],
    }],
  };
}

function media(overrides = {}) {
  return { id: "media-one", type: "image", name: "photo.jpg", mimeType: "image/jpeg", dataUrl: "data:image/jpeg;base64,aGVsbG8=", ...overrides };
}

test("duration entry accepts minutes and hours and rejects invalid or negative fields", () => {
  assert.equal(parseWorkoutDuration("02:00"), 120);
  assert.equal(parseWorkoutDuration("1:10:00"), 4200);
  assert.equal(parseWorkoutDuration("70:00"), 4200);
  assert.equal(parseWorkoutDuration(" 120 "), 120);
  for (const value of ["", "2:60", "1:60:00", "-1", "1.5", "nope", "1:2:3:4", "9007199254740992"]) assert.equal(parseWorkoutDuration(value), null, value);
  for (const seconds of [0, 70, 3599, 3600, 4200, 86400]) assert.equal(parseWorkoutDuration(formatWorkoutDuration(seconds)), seconds);
  assert.equal(formatWorkoutDuration(120), "02:00");
  assert.equal(formatWorkoutDuration(4200), "01:10:00");
});

test("datetime inputs preserve local time and reject calendar rollover", () => {
  const local = new Date(2026, 9, 8, 5, 15, 0, 0);
  assert.equal(toLocalDateTimeInput(local.toISOString()), "2026-10-08T05:15");
  assert.equal(fromLocalDateTimeInput("2026-10-08T05:15"), local.toISOString());
  assert.equal(fromLocalDateTimeInput("2026-10-08T05:15:12"), new Date(2026, 9, 8, 5, 15, 12, 0).toISOString());
  for (const value of ["2026-02-30T05:15", "2026-13-08T05:15", "2026-10-08T24:00", "2026-10-08T05:60", "2026-10-08", ""]) assert.equal(fromLocalDateTimeInput(value), null, value);
  assert.equal(toLocalDateTimeInput("bad date"), "");
});

test("saved edits preserve identity and metadata, reindex sets, and queue sync without mutating source", () => {
  const original = session();
  original.media = [media()];
  const untouched = structuredClone(original);
  const result = prepareCompletedWorkoutEdit(original, { startedAt: start, durationSeconds: 4200 }, now);
  assert.deepEqual(original, untouched);
  assert.equal(result.id, original.id);
  for (const field of ["tags", "programId", "programDay", "importSource", "importBatchId", "sourceFingerprint", "notes", "media"]) assert.deepEqual(result[field], original[field]);
  assert.equal(result.name, "Upper day");
  assert.equal(result.location, "My gym");
  assert.equal(result.completedAt, "2026-10-08T06:25:00.000Z");
  assert.equal(result.status, "completed");
  assert.equal(result.syncStatus, "pending");
  assert.equal(result.restUntil, null);
  assert.equal(result.updatedAt, now);
  assert.deepEqual(result.exercises[0].sets.map(set => set.index), [0, 1]);
  assert.deepEqual(result.exercises[0].sets.map(set => set.id), ["bench-set-one", "bench-set-two"]);
  assert.equal(result.exercises[0].sets[0].completedAt, result.completedAt);
  assert.equal(result.exercises[0].sets[1].completedAt, null);
  assert.notEqual(result.exercises, original.exercises);
  assert.notEqual(result.media, original.media);
});

test("cardio sets retain distance, time, and exercise notes through editing and backups", () => {
  const workout = session();
  workout.exercises = [{
    ...workout.exercises[0], id: "cycling-row", exerciseId: "cycling", name: "Cycling", trackingType: "cardio", notes: "Easy warm-up",
    sets: [{ id: "cycling-set", index: 3, weight: null, reps: null, rpe: null, distanceKm: 2.5, durationSeconds: 120, completed: true, completedAt: start }],
  }];
  const result = prepareCompletedWorkoutEdit(workout, { startedAt: start, durationSeconds: 4200 }, now);
  assert.equal(result.exercises[0].trackingType, "cardio");
  assert.equal(result.exercises[0].notes, "Easy warm-up");
  assert.equal(result.exercises[0].sets[0].distanceKm, 2.5);
  assert.equal(result.exercises[0].sets[0].durationSeconds, 120);
  const restored = parseBackup(JSON.stringify({ arcus: 3, workouts: [result], programs: [], physique: [], customExercises: [] })).workouts[0];
  assert.deepEqual(restored.exercises, result.exercises);
});

test("legacy strength workouts remain valid without cardio or media fields", () => {
  const workout = session();
  delete workout.location;
  delete workout.exercises[0].notes;
  delete workout.exercises[0].trackingType;
  assert.equal(workoutSchema.safeParse(workout).success, true);
  assert.equal(prepareCompletedWorkoutEdit(workout, { startedAt: start, durationSeconds: 600 }, now).exercises[0].sets[0].reps, 8);
});

test("editor rejects empty workouts, unfinished sessions, invalid dates and duration", () => {
  const timing = { startedAt: start, durationSeconds: 4200 };
  assert.throws(() => prepareCompletedWorkoutEdit({ ...session(), name: " " }, timing, now), /name/);
  assert.throws(() => prepareCompletedWorkoutEdit({ ...session(), exercises: [] }, timing, now), /exercise/);
  const unfinished = session();
  unfinished.exercises[0].sets.forEach(set => { set.completed = false; });
  assert.throws(() => prepareCompletedWorkoutEdit(unfinished, timing, now), /Complete at least one set/);
  for (const durationSeconds of [0, -1, 86401, 1.5, NaN]) assert.throws(() => prepareCompletedWorkoutEdit(session(), { ...timing, durationSeconds }, now), /duration/);
  for (const startedAt of ["bad", "2026-02-30T05:15:00Z"]) assert.throws(() => prepareCompletedWorkoutEdit(session(), { ...timing, startedAt }, now), /date and time/);
});

test("editor validates actual completed set measurements and domain bounds", () => {
  const timing = { startedAt: start, durationSeconds: 4200 };
  const blank = session();
  blank.exercises[0].sets[0].reps = null;
  assert.throws(() => prepareCompletedWorkoutEdit(blank, timing, now), /Enter reps/);
  blank.exercises[0].trackingType = "cardio";
  assert.throws(() => prepareCompletedWorkoutEdit(blank, timing, now), /Enter a distance or time/);
  for (const invalid of [{ weight: -1 }, { reps: 1.5 }, { rpe: 11 }, { distanceKm: -1 }, { durationSeconds: 86401 }]) {
    const workout = session();
    Object.assign(workout.exercises[0].sets[0], invalid);
    assert.throws(() => prepareCompletedWorkoutEdit(workout, timing, now), /sets/);
  }
  const duplicate = session();
  duplicate.exercises[0].sets[1].id = duplicate.exercises[0].sets[0].id;
  assert.throws(() => prepareCompletedWorkoutEdit(duplicate, timing, now), /unique IDs/);
});

test("media validates formats, matching types, prefixes, and total payload limits", () => {
  for (const mimeType of ["image/jpeg", "image/png", "image/webp", "video/mp4", "video/webm", "video/quicktime"]) {
    const entry = media({ mimeType, type: mimeType.startsWith("image/") ? "image" : "video", dataUrl: `data:${mimeType};base64,aGVsbG8=` });
    assert.equal(workoutSchema.safeParse({ ...session(), media: [entry] }).success, true, mimeType);
  }
  for (const entry of [media({ type: "video" }), media({ mimeType: "image/svg+xml", dataUrl: "data:image/svg+xml;base64,aGVsbG8=" }), media({ dataUrl: "https://example.com/photo.jpg" }), media({ dataUrl: "data:image/png;base64,aGVsbG8=" }), media({ dataUrl: "data:image/jpeg;base64,<script>" })]) {
    assert.equal(workoutSchema.safeParse({ ...session(), media: [entry] }).success, false);
  }
  assert.equal(workoutSchema.safeParse({ ...session(), media: Array.from({ length: 4 }, (_, index) => media({ id: `media-${index}` })) }).success, false);
  const big = media({ dataUrl: `data:image/jpeg;base64,${"A".repeat(Math.floor(MAX_WORKOUT_MEDIA_DATA_LENGTH / 2))}` });
  assert.equal(workoutSchema.safeParse({ ...session(), media: [big] }).success, true);
  assert.equal(workoutSchema.safeParse({ ...session(), media: [big, { ...big, id: "media-two" }] }).success, false);
});

test("cardio totals exclude strength volume and reps, including legacy Cardio muscle entries", () => {
  const workout = session();
  workout.exercises.push({ ...workout.exercises[0], id: "cardio", trackingType: "cardio", sets: [{ ...workout.exercises[0].sets[0], id: "cardio-set", weight: 200, reps: 100, distanceKm: 2.5, durationSeconds: 120 }] });
  assert.equal(calculateWorkoutTotals(workout).sets, 2);
  assert.equal(calculateWorkoutTotals(workout).reps, 8);
  assert.equal(calculateWorkoutTotals(workout).volume, 640);
  delete workout.exercises[1].trackingType;
  workout.exercises[1].muscle = "Cardio";
  assert.equal(calculateWorkoutTotals(workout).volume, 640);
});

test("converted and legacy cardio records never create strength PRs or muscle volume", () => {
  const workout = session();
  const converted = { ...workout.exercises[0], id: "cycling-row", exerciseId: "cycling", name: "Cycling", trackingType: "cardio",
    sets: [{ ...workout.exercises[0].sets[0], id: "cycling-set", weight: 200, reps: 1, distanceKm: 2.5, durationSeconds: 120 }] };
  const legacy = { ...converted, id: "running-row", exerciseId: "running", name: "Running", muscle: "Cardio", trackingType: undefined,
    sets: [{ ...converted.sets[0], id: "running-set" }] };
  workout.exercises.push(converted, legacy);
  assert.deepEqual(getCompletedSets(converted), []);
  assert.deepEqual(getCompletedSets(legacy), []);
  assert.equal(calculateEstimatedBest([workout], "cycling"), 0);
  assert.equal(recommendNextLoad(converted).load, null);
  assert.deepEqual(calculateMuscleVolume([workout]), [{ muscle: "Chest", volume: 640 }]);
  assert.ok(findPersonalRecords([workout]).every(record => record.exerciseId === "bench"));
  const records = detectRecords([workout]);
  assert.ok(records.every(record => record.exerciseId === "bench"));
  assert.equal(records.find(record => record.type === "volume").value, calculateWorkoutTotals(workout).volume);
  assert.equal(converted.sets[0].weight, 200);
  assert.equal(converted.sets[0].reps, 1);
});

test("large workouts are checked against serialized UTF-8 bytes before sync", () => {
  const workout = session();
  workout.exercises = Array.from({ length: 76 }, (_, index) => ({
    ...workout.exercises[0], id: `exercise-${index}`, notes: "€".repeat(4000),
    sets: [{ ...workout.exercises[0].sets[0], id: `set-${index}` }],
  }));
  assert.equal(workoutSchema.safeParse(workout).success, true);
  assert.ok(JSON.stringify(workout).length < 900000);
  assert.throws(() => prepareCompletedWorkoutEdit(workout, { startedAt: start, durationSeconds: 4200 }, now), /too large to save/);
});

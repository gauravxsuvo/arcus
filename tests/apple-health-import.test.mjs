import test from "node:test";
import assert from "node:assert/strict";
import { parseAppleHealthExport } from "../src/features/import-export/apple-health.ts";

const sample = `<?xml version="1.0"?><HealthData>
  <Workout workoutActivityType="HKWorkoutActivityTypeTraditionalStrengthTraining" startDate="2026-10-08 17:00:00 +0530" endDate="2026-10-08 18:02:00 +0530"/>
  <Workout workoutActivityType="HKWorkoutActivityTypeRunning" startDate="2026-10-07 06:00:00 +0530" endDate="2026-10-07 06:30:00 +0530"/>
  <Record type="HKQuantityTypeIdentifierBodyMass" unit="lb" value="160" startDate="2026-10-08 08:00:00 +0530"/>
  <Record type="HKQuantityTypeIdentifierBodyMass" unit="kg" value="73" startDate="2026-10-08 09:00:00 +0530"/>
  <Record type="HKQuantityTypeIdentifierStepCount" unit="count" value="4000" startDate="2026-10-08 09:00:00 +0530"/>
</HealthData>`;

test("imports supported Apple Health workouts and converts body mass into kilograms", () => {
  const result = parseAppleHealthExport(sample);
  assert.equal(result.workouts.length, 2);
  assert.equal(result.workouts[0].name, "Traditional Strength Training");
  assert.equal(result.workouts[0].notes, "Imported from Apple Health · 62 min");
  assert.equal(result.workouts[0].importSource, "apple-health");
  assert.equal(result.metrics.length, 2);
  assert.ok(Math.abs(result.metrics[0].value - 72.5748) < 0.001);
  assert.equal(result.metrics[1].value, 73);
});

test("rejects non-Apple exports and exports without supported records", () => {
  assert.throws(() => parseAppleHealthExport("<root/>"), /doesn’t look like an Apple Health export/);
  assert.throws(() => parseAppleHealthExport("<HealthData><Record type=\"HKQuantityTypeIdentifierStepCount\"/></HealthData>"), /No supported workouts or bodyweight entries/);
});

test("ignores duplicate records and skips invalid workout or weight rows", () => {
  const xml = `<HealthData>
    <Workout workoutActivityType="HKWorkoutActivityTypeRunning" startDate="2026-10-08 10:00:00 +0530" endDate="2026-10-08 11:00:00 +0530"/>
    <Workout workoutActivityType="HKWorkoutActivityTypeRunning" startDate="2026-10-08 10:00:00 +0530" endDate="2026-10-08 11:00:00 +0530"/>
    <Workout startDate="bad" endDate="bad"/>
    <Record type="HKQuantityTypeIdentifierBodyMass" unit="stone" value="10" startDate="2026-10-08 10:00:00 +0530"/>
  </HealthData>`;
  const result = parseAppleHealthExport(xml);
  assert.equal(result.workouts.length, 1);
  assert.equal(result.skippedRows, 3);
});

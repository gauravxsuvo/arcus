import test from "node:test";
import assert from "node:assert/strict";
import { buildWeightTrend, weightInKg } from "../src/features/weight/weight-trend.ts";

test("weight trend converts mixed units and uses observed entries in a trailing calendar week", () => {
  assert.ok(Math.abs(weightInKg({ date: "2026-10-01", weight: 220.462262, unit: "lbs" }) - 100) < 0.00001);
  const trend = buildWeightTrend([
    { date: "2026-10-01", weight: 80, unit: "kg" },
    { date: "2026-10-04", weight: 80.4, unit: "kg" },
    { date: "2026-10-08", weight: 176.37, unit: "lbs" },
  ]);
  assert.ok(Math.abs((trend.latestKg ?? 0) - 80) < 0.001);
  assert.ok(Math.abs((trend.average7dKg ?? 0) - 80.2002) < 0.001);
  assert.equal(trend.points.at(-1)?.date, "2026-10-08");
  assert.equal(trend.points.find((point) => point.date === "2026-10-02")?.weightKg, Number.NaN);
});

test("weight trend returns an empty result without invented observations", () => {
  assert.deepEqual(buildWeightTrend([]), { points: [], latestKg: null, average7dKg: null, delta30dKg: null });
});

test("30-day delta requires an actual baseline observation at least thirty days earlier", () => {
  const recentOnly = buildWeightTrend([
    { date: "2026-10-01", weight: 80, unit: "kg" },
    { date: "2026-10-11", weight: 79.5, unit: "kg" },
  ]);
  assert.equal(recentOnly.delta30dKg, null);
  const withBaseline = buildWeightTrend([
    { date: "2026-09-01", weight: 81, unit: "kg" },
    { date: "2026-10-11", weight: 79.5, unit: "kg" },
  ]);
  assert.equal(withBaseline.delta30dKg, -1.5);
});

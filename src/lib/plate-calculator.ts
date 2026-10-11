export type PlateUnit = "kg" | "lbs";
export type PlateCount = { weight: number; count: number };
export type PlateBreakdown = { platesPerSide: PlateCount[]; achievableWeight: number; isExact: boolean };

const STANDARD_PLATES: Record<PlateUnit, readonly number[]> = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lbs: [45, 35, 25, 10, 5, 2.5],
};

/** Greedy plate loading, returned for one side of the bar. Never exceeds the target. */
export function calculatePlates(targetWeight: number, barWeight = 20, unit: PlateUnit = "kg"): PlateBreakdown {
  if (!Number.isFinite(targetWeight) || !Number.isFinite(barWeight) || targetWeight < 0 || barWeight < 0) {
    return { platesPerSide: [], achievableWeight: Math.max(0, Number.isFinite(barWeight) ? barWeight : 0), isExact: false };
  }

  const plateLoadPerSide = Math.max(0, (targetWeight - barWeight) / 2);
  let remaining = plateLoadPerSide;
  const counts = new Map<number, number>();
  for (const plate of STANDARD_PLATES[unit]) {
    const count = Math.floor((remaining + 1e-8) / plate);
    if (count > 0) {
      counts.set(plate, count);
      remaining -= plate * count;
    }
  }

  const platesPerSide = [...counts].map(([weight, count]) => ({ weight, count }));
  const loadedPerSide = platesPerSide.reduce((total, plate) => total + plate.weight * plate.count, 0);
  const achievableWeight = barWeight + loadedPerSide * 2;
  return { platesPerSide, achievableWeight, isExact: Math.abs(achievableWeight - targetWeight) < 0.01 };
}

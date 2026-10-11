export type WeightLog = { date: string; weight: number; unit: "kg" | "lbs"; notes?: string | null };
export type WeightTrendPoint = { date: string; weightKg: number; average7dKg: number | null };
const KG_PER_LB = 0.45359237;

export function weightInKg(log: WeightLog): number { return log.unit === "lbs" ? log.weight * KG_PER_LB : log.weight; }

export function buildWeightTrend(logs: WeightLog[], days = 90): { points: WeightTrendPoint[]; latestKg: number | null; average7dKg: number | null; delta30dKg: number | null } {
  const sorted = [...logs].filter((log) => /^\d{4}-\d{2}-\d{2}$/.test(log.date) && Number.isFinite(log.weight) && log.weight > 0).sort((a, b) => a.date.localeCompare(b.date));
  if (!sorted.length) return { points: [], latestKg: null, average7dKg: null, delta30dKg: null };
  const byDate = new Map(sorted.map((log) => [log.date, weightInKg(log)]));
  const today = new Date(`${sorted[sorted.length - 1].date}T00:00:00.000Z`);
  const first = new Date(`${sorted[0].date}T00:00:00.000Z`);
  const since = new Date(today); since.setUTCDate(since.getUTCDate() - Math.max(0, days - 1));
  const start = first > since ? first : since;
  const points: WeightTrendPoint[] = [];
  for (const day = new Date(start); day <= today; day.setUTCDate(day.getUTCDate() + 1)) {
    const date = day.toISOString().slice(0, 10);
    const windowStart = new Date(day); windowStart.setUTCDate(windowStart.getUTCDate() - 6);
    const windowValues = [...byDate.entries()].filter(([key]) => key >= windowStart.toISOString().slice(0, 10) && key <= date).map(([, value]) => value);
    points.push({ date, weightKg: byDate.get(date) ?? Number.NaN, average7dKg: windowValues.length ? windowValues.reduce((sum, value) => sum + value, 0) / windowValues.length : null });
  }
  const latest = sorted[sorted.length - 1];
  const cutoff = new Date(`${latest.date}T00:00:00.000Z`); cutoff.setUTCDate(cutoff.getUTCDate() - 30);
  const baseline = [...sorted].reverse().find((log) => new Date(`${log.date}T00:00:00.000Z`) <= cutoff);
  const recentAverageValues = [...byDate.entries()].filter(([date]) => date >= new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 6)).toISOString().slice(0, 10)).map(([, value]) => value);
  return { points, latestKg: weightInKg(latest), average7dKg: recentAverageValues.length ? recentAverageValues.reduce((sum, value) => sum + value, 0) / recentAverageValues.length : null, delta30dKg: baseline ? weightInKg(latest) - weightInKg(baseline) : null };
}

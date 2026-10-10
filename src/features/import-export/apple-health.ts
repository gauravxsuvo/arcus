import type { PhysiqueEntry } from "../physique/model.ts";
import type { WorkoutRecord } from "../workouts/model.ts";

export type AppleHealthImport = { workouts: WorkoutRecord[]; metrics: PhysiqueEntry[]; skippedRows: number };

function decodeXml(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function attributes(tag: string) {
  const values: Record<string, string> = {};
  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*"([^"]*)"/g)) values[match[1]] = decodeXml(match[2]);
  return values;
}

function parseDate(value: string | undefined) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null;
}

function activityName(value: string | undefined) {
  const name = (value ?? "").replace(/^HKWorkoutActivityType/, "").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  return name || "Imported workout";
}

/** Import the workout and body-mass records in an Apple Health export.xml file. */
export function parseAppleHealthExport(xml: string): AppleHealthImport {
  if (xml.length > 100 * 1024 * 1024) throw new Error("Apple Health export is larger than the 100 MB safety limit.");
  if (!/<HealthData\b/i.test(xml)) throw new Error("This doesn’t look like an Apple Health export.xml file.");

  const workouts: WorkoutRecord[] = [];
  const metrics: PhysiqueEntry[] = [];
  let skippedRows = 0;
  const seenWorkoutKeys = new Set<string>();
  const seenMetricKeys = new Set<string>();
  const now = new Date().toISOString();

  for (const match of xml.matchAll(/<Workout\b([^>]*)\/?\s*>/g)) {
    const item = attributes(match[1]);
    const startedAt = parseDate(item.startDate);
    const completedAt = parseDate(item.endDate);
    if (!startedAt || !completedAt || Date.parse(completedAt) < Date.parse(startedAt)) { skippedRows++; continue; }
    const activity = activityName(item.workoutActivityType);
    const fingerprint = `apple-health:${item.workoutActivityType ?? "unknown"}:${startedAt}:${completedAt}`;
    if (seenWorkoutKeys.has(fingerprint)) { skippedRows++; continue; }
    seenWorkoutKeys.add(fingerprint);
    const duration = Math.round((Date.parse(completedAt) - Date.parse(startedAt)) / 60_000);
    workouts.push({
      id: crypto.randomUUID(), name: activity, startedAt, completedAt, status: "completed", exercises: [],
      notes: `Imported from Apple Health · ${duration} min`, tags: ["Apple Health"], restUntil: null,
      updatedAt: now, syncStatus: "pending", importSource: "apple-health", sourceFingerprint: fingerprint,
    });
  }

  for (const match of xml.matchAll(/<Record\b([^>]*)\/?\s*>/g)) {
    const item = attributes(match[1]);
    if (item.type !== "HKQuantityTypeIdentifierBodyMass") continue;
    const measuredAt = parseDate(item.startDate ?? item.creationDate);
    const value = Number(item.value);
    if (!measuredAt || !Number.isFinite(value) || value <= 0) { skippedRows++; continue; }
    const kilograms = item.unit?.toLowerCase() === "lb" ? value * 0.45359237 : item.unit?.toLowerCase() === "kg" ? value : NaN;
    if (!Number.isFinite(kilograms) || kilograms < 20 || kilograms > 500) { skippedRows++; continue; }
    const fingerprint = `apple-health:bodymass:${measuredAt}:${kilograms.toFixed(3)}`;
    if (seenMetricKeys.has(fingerprint)) { skippedRows++; continue; }
    seenMetricKeys.add(fingerprint);
    metrics.push({ id: crypto.randomUUID(), kind: "bodyweight", metric: "Bodyweight", value: kilograms, unit: "kg", measuredAt, notes: "Imported from Apple Health", syncStatus: "pending", updatedAt: now, sourceFingerprint: fingerprint });
  }

  if (!workouts.length && !metrics.length) throw new Error("No supported workouts or bodyweight entries were found in this export.");
  return { workouts, metrics, skippedRows };
}

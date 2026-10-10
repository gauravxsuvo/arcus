export type PhysiqueEntry = {
  id: string;
  kind: "bodyweight" | "measurement";
  metric: string;
  value: number;
  unit: "kg" | "cm";
  measuredAt: string;
  notes: string;
  syncStatus?: "pending" | "synced" | "error";
  deleted?: boolean;
  updatedAt?: string;
  importBatchId?: string;
  sourceFingerprint?: string;
};

export const MEASUREMENT_SITES = ["Waist", "Chest", "Hips", "Left arm", "Right arm", "Left thigh", "Right thigh", "Neck"] as const;
export type MeasurementSite = (typeof MEASUREMENT_SITES)[number];

"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { calculateProgressionTarget, type WorkingMeasurement } from "@/features/workouts/overload-engine";
import { formatWeight } from "@/features/training/logic";
import styles from "./ghost-coach.module.css";

export function GhostCoachAdvisor({ exerciseId, muscle, previousSets, lastSessionAt, units, canApply, onApply }: {
  exerciseId: string; muscle: string; previousSets: WorkingMeasurement[]; lastSessionAt: string | null; units: "metric" | "imperial"; canApply: boolean;
  onApply: (target: WorkingMeasurement) => void;
}) {
  const [choice, setChoice] = useState<"load" | "reps">("load");
  const target = useMemo(() => calculateProgressionTarget(exerciseId, previousSets, muscle), [exerciseId, muscle, previousSets]);
  if (!target) return null;
  const priorDate = lastSessionAt ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(lastSessionAt)) : "your last session";
  return <aside className={styles.advisor} aria-label="Progression suggestion"><div className={styles.mark}><Sparkles size={14}/><span>GHOST COACH</span></div><p>Last time: <strong>{formatWeight(target.previous.weight, units)} × {target.previous.reps}</strong> <span>· {priorDate}</span></p><div className={styles.options}><button type="button" aria-pressed={choice === "load"} onClick={() => setChoice("load")}>Add load <strong>{formatWeight(target.weightProgression.weight, units)} × {target.weightProgression.minReps}–{target.weightProgression.maxReps}</strong></button><button type="button" aria-pressed={choice === "reps"} onClick={() => setChoice("reps")}>Add a rep <strong>{formatWeight(target.repProgression.weight, units)} × {target.repProgression.reps}</strong></button></div><div className={styles.footer}><small>Rep path volume {target.projectedTopSetVolumeDeltaPercent >= 0 ? "+" : ""}{target.projectedTopSetVolumeDeltaPercent}%</small><button type="button" disabled={!canApply} onClick={() => onApply(choice === "load" ? { weight: target.weightProgression.weight, reps: target.weightProgression.minReps } : target.repProgression)}>{canApply ? "Apply goal" : "Add an empty set first"}<ArrowRight size={14}/></button></div></aside>;
}

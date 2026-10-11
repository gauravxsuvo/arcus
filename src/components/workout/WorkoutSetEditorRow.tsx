"use client";

import { memo } from "react";
import { ArrowDown, ArrowUp, Check, CheckCircle2, Copy, Trash2 } from "lucide-react";
import { AnimatedSetRow } from "@/components/shared/animated-set-row";
import { NumericInput } from "@/components/shared/numeric-input";
import { PreviousSet } from "@/components/workout/previous-set";
import { SetTagBadge } from "@/components/workout/SetTagBadge";
import { calculateOneRepMax } from "@/lib/fitness-calc";
import { isCardioExercise, type LoggedSet, type WorkoutExercise } from "@/features/workouts/model";
import { formatWeight, fromDisplayWeight, toDisplayWeight, weightUnit } from "@/features/training/logic";
import { measurementCopy } from "@/features/workouts/set-assistance";
import type { Units } from "@/features/profile/model";
import { PressButton } from "@/components/shared/press-button";
import styles from "@/app/workout/workout.module.css";

type Props = {
  exercise: WorkoutExercise;
  previous?: WorkoutExercise;
  set: LoggedSet;
  index: number;
  setNumber: number;
  units: Units;
  effortSystem: "rpe" | "rir";
  error?: string;
  onUpdate: (exerciseId: string, setId: string, update: Partial<LoggedSet>) => void;
  onAdjust: (exerciseId: string, setId: string, field: "weight" | "reps", delta: number) => void;
  onComplete: (exerciseId: string, setId: string) => void;
  onDelete: (exerciseId: string, setId: string) => void;
  onDuplicate: (exerciseId: string, setId: string) => void;
  onMove: (exerciseId: string, setId: string, direction: -1 | 1) => void;
};

function WorkoutSetEditorRow({ exercise, previous, set, index, setNumber, units, effortSystem, error, onUpdate, onAdjust, onComplete, onDelete, onDuplicate, onMove }: Props) {
  const cardio = isCardioExercise(exercise);
  const effort = effortSystem === "rir" ? set.rir : set.rpe;
  const estimatedMax = !cardio && set.weight !== null && set.reps !== null ? calculateOneRepMax(toDisplayWeight(set.weight, units), set.reps) : null;

  return <AnimatedSetRow className={`set-row ${styles.setRow} ${set.completed ? "set-row-done" : ""} ${set.setType === "warmup" ? "set-row-warmup" : ""}`} key={set.id} deleteLabel={`Set ${index + 1} of ${exercise.name}`} onDelete={exercise.sets.length > 1 ? () => onDelete(exercise.id, set.id) : undefined} onDuplicate={() => onDuplicate(exercise.id, set.id)}>
    <div className="set-index"><SetTagBadge setType={set.setType} setNumber={setNumber} onChange={setType => onUpdate(exercise.id, set.id, { setType })}/></div>
    <div className="number-stepper">
      <span className="stepper-label">{cardio ? "Distance · km" : `Weight · ${weightUnit(units)}`}</span>
      <button type="button" aria-label={`Decrease set ${index + 1} ${cardio ? "distance" : "weight"}`} onClick={() => onAdjust(exercise.id, set.id, "weight", -2.5)}>−</button>
      <NumericInput inputMode="decimal" min="0" max={cardio ? 10000 : toDisplayWeight(2000, units)} step="0.5" placeholder={cardio ? "—" : set.previousWeight == null ? "BW" : String(Number(toDisplayWeight(set.previousWeight, units).toFixed(2)))} aria-label={`Set ${index + 1} ${cardio ? "distance in km" : "weight"}`} aria-describedby={[`previous-set-${set.id}`, error ? `set-error-${set.id}` : null].filter(Boolean).join(" ")} aria-invalid={error ? true : undefined} value={cardio ? set.distanceKm ?? "" : set.weight === null ? "" : Number(toDisplayWeight(set.weight, units).toFixed(2))} onChange={event => onUpdate(exercise.id, set.id, cardio ? { distanceKm: event.target.value === "" ? null : Number(event.target.value) } : { weight: event.target.value === "" ? null : fromDisplayWeight(Number(event.target.value), units) })}/>
      <button type="button" aria-label={`Increase set ${index + 1} ${cardio ? "distance" : "weight"}`} onClick={() => onAdjust(exercise.id, set.id, "weight", 2.5)}>+</button>
    </div>
    <div className={`number-stepper ${styles.repsStepper}`}>
      <span className="stepper-label">{cardio ? "Time · minutes" : "Reps"}</span>
      <button type="button" aria-label={`Decrease set ${index + 1} ${cardio ? "time" : "reps"}`} onClick={() => onAdjust(exercise.id, set.id, "reps", -1)}>−</button>
      <NumericInput aria-label={`Set ${index + 1} ${cardio ? "time in minutes" : "reps"}`} aria-describedby={[`previous-set-${set.id}`, error ? `set-error-${set.id}` : null].filter(Boolean).join(" ")} aria-invalid={error ? true : undefined} inputMode={cardio ? "decimal" : "numeric"} min="0" max={cardio ? 1440 : 10000} step={cardio ? 0.5 : 1} placeholder={cardio ? "—" : set.previousReps == null ? "—" : String(set.previousReps)} value={cardio ? set.durationSeconds == null ? "" : Number((set.durationSeconds / 60).toFixed(2)) : set.reps ?? ""} onChange={event => onUpdate(exercise.id, set.id, cardio ? { durationSeconds: event.target.value === "" ? null : Math.round(Number(event.target.value) * 60) } : { reps: event.target.value === "" ? null : Number(event.target.value) })}/>
      <button type="button" aria-label={`Increase set ${index + 1} ${cardio ? "time" : "reps"}`} onClick={() => onAdjust(exercise.id, set.id, "reps", 1)}>+</button>
      {estimatedMax !== null && <span className={styles.oneRepMax}>est. 1RM: {formatWeight(estimatedMax, units, 1)}</span>}
    </div>
    <label className="set-effort"><span>{effortSystem.toUpperCase()}</span><select className="effort-selector" aria-label={`Set ${index + 1} ${effortSystem.toUpperCase()}`} value={effort ?? ""} onChange={event => onUpdate(exercise.id, set.id, { [effortSystem]: event.target.value === "" ? null : Number(event.target.value) })}><option value="">—</option>{Array.from({ length: effortSystem === "rir" ? 6 : 10 }, (_, i) => effortSystem === "rir" ? i : i + 1).map(value => <option key={value} value={value}>{value}</option>)}</select></label>
    <div className="set-row-actions"><PressButton className={`complete-set ${set.completed ? "complete-set-active" : ""}`} aria-pressed={set.completed} aria-label={set.completed ? `Undo set ${index + 1}` : `Complete set ${index + 1}`} onClick={() => onComplete(exercise.id, set.id)}>{set.completed ? <Check size={17}/> : <CheckCircle2 size={19}/>}</PressButton><details className="set-actions"><summary aria-label={`Set ${index + 1} actions`}>···</summary><div className="set-action-menu"><button type="button" onClick={() => onMove(exercise.id, set.id, -1)} disabled={index === 0}><ArrowUp size={13}/> Move up</button><button type="button" onClick={() => onMove(exercise.id, set.id, 1)} disabled={index === exercise.sets.length - 1}><ArrowDown size={13}/> Move down</button><button type="button" onClick={() => onDuplicate(exercise.id, set.id)}><Copy size={13}/> Duplicate</button><button type="button" onClick={() => onDelete(exercise.id, set.id)} disabled={exercise.sets.length < 2}><Trash2 size={13}/> Delete</button></div></details></div>
    <PreviousSet exercise={exercise} set={set} previous={previous} units={units} onUse={source => onUpdate(exercise.id, set.id, measurementCopy(source, exercise))}/>
    {error && <p className="set-validation-error" id={`set-error-${set.id}`} role="alert">{error}</p>}
    <details className="effort-picks"><summary>Set {index + 1} · tap {effortSystem.toUpperCase()} value</summary><div role="group" aria-label={`Choose effort for set ${index + 1}`}>{Array.from({ length: effortSystem === "rir" ? 6 : 10 }, (_, i) => effortSystem === "rir" ? i : i + 1).map(value => <button type="button" key={value} aria-pressed={effort === value} onClick={() => onUpdate(exercise.id, set.id, { [effortSystem]: value })}>{value}</button>)}</div></details>
  </AnimatedSetRow>;
}

export default memo(WorkoutSetEditorRow);

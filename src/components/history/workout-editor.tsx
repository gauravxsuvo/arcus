"use client";

import { NumericInput } from "@/components/shared/numeric-input";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ArrowDown, ArrowUp, Bike, CalendarDays, Check, ChevronRight, Dumbbell, ImagePlus, LockKeyhole, MapPin, MoreVertical, Plus, LoaderCircle, Timer, Trash2, X } from "lucide-react";
import { useToast } from "@/components/shared/toast-provider";
import { usePageTitle } from "@/components/shared/page-title";
import { setEntryError } from "@/features/workouts/set-validation";
import { useProfile } from "@/components/shared/user-profile-provider";
import { ExercisePicker } from "@/components/workout/exercise-picker";
import { exerciseCatalog, type Exercise } from "@/features/exercises/catalog";
import { getExercisePreferences, listCustomExercises } from "@/features/local-data/repository";
import type { PickerPreference } from "@/features/exercises/picker";
import { calculateWorkoutTotals, isCardioExercise, MAX_WORKOUT_MEDIA, type LoggedSet, type WorkoutExercise, type WorkoutRecord } from "@/features/workouts/model";
import { formatWorkoutDuration, fromLocalDateTimeInput, parseWorkoutDuration, prepareCompletedWorkoutEdit, toLocalDateTimeInput } from "@/features/workouts/edit";
import { prepareWorkoutMedia } from "@/features/workouts/media";
import { saveWorkout } from "@/features/workouts/repository";
import { formatWeight, fromDisplayWeight, toDisplayWeight, weightUnit } from "@/features/training/logic";

function newSet(index: number): LoggedSet {
  return { id: crypto.randomUUID(), index, weight: null, reps: null, rpe: null, completed: false, completedAt: null, setType: "working" };
}
function numberValue(value: string) { return value === "" ? null : Number(value); }

export function WorkoutEditor({ workout, history, onCancel, onSaved }: {
  workout: WorkoutRecord; history: WorkoutRecord[]; onCancel: () => void; onSaved: (workout: WorkoutRecord) => void;
}) {
  const { preferences } = useProfile();
  const { showToast } = useToast();
  const [draft, setDraft] = useState(() => structuredClone(workout));
  const [startedAt, setStartedAt] = useState(toLocalDateTimeInput(workout.startedAt));
  const [duration, setDuration] = useState(formatWorkoutDuration(calculateWorkoutTotals(workout).durationSeconds));
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [catalog, setCatalog] = useState(exerciseCatalog);
  const [pickerPreferences, setPickerPreferences] = useState<PickerPreference[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(workout) || startedAt !== toLocalDateTimeInput(workout.startedAt) || duration !== formatWorkoutDuration(calculateWorkoutTotals(workout).durationSeconds);
  const totals = calculateWorkoutTotals(draft);
  usePageTitle(`Edit ${draft.name.trim() || "workout"}`);
  const previousExercises = useMemo(() => {
    const previous = history.filter(item => item.id !== workout.id && item.startedAt < workout.startedAt).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    const rows = new Map<string, WorkoutExercise>();
    for (const item of previous) for (const exercise of item.exercises) if (!rows.has(exercise.exerciseId)) rows.set(exercise.exerciseId, exercise);
    return rows;
  }, [history, workout.id, workout.startedAt]);

  useEffect(() => {
    document.body.classList.add("workout-editing");
    return () => document.body.classList.remove("workout-editing");
  }, []);
  useEffect(() => {
    void Promise.all([listCustomExercises(), getExercisePreferences()]).then(([custom, settings]) => {
      setCatalog([...exerciseCatalog, ...custom]); setPickerPreferences(settings);
    }).catch(() => undefined);
  }, []);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function changeExercise(id: string, change: Partial<WorkoutExercise>) {
    setDraft(current => ({ ...current, exercises: current.exercises.map(item => item.id === id ? { ...item, ...change } : item) }));
  }
  function changeSet(exerciseId: string, setId: string, change: Partial<LoggedSet>) {
    setDraft(current => ({ ...current, exercises: current.exercises.map(exercise => exercise.id === exerciseId ? { ...exercise, sets: exercise.sets.map(set => set.id === setId ? { ...set, ...change } : set) } : exercise) }));
  }
  function moveExercise(index: number, direction: number) {
    setDraft(current => { const exercises = [...current.exercises]; [exercises[index], exercises[index + direction]] = [exercises[index + direction], exercises[index]]; return { ...current, exercises }; });
  }
  function addExercise(exercise: Exercise) {
    setDraft(current => ({ ...current, exercises: [...current.exercises, {
      id: crypto.randomUUID(), exerciseId: exercise.id, name: exercise.name, muscle: exercise.muscle, equipment: exercise.equipment,
      restSeconds: exercise.restSeconds, trackingType: exercise.muscle === "Cardio" ? "cardio" : "strength", sets: [newSet(0)],
    }] }));
    setPickerOpen(false);
  }
  async function attach(file?: File) {
    if (!file) return;
    setUploading(true); setMessage("");
    try { const media = await prepareWorkoutMedia(file, draft.media ?? []); setDraft(current => ({ ...current, media: [...(current.media ?? []), media] })); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not attach this file."); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ""; }
  }
  async function save() {
    setMessage(""); setSaving(true);
    try {
      const start = startedAt === toLocalDateTimeInput(workout.startedAt) ? workout.startedAt : fromLocalDateTimeInput(startedAt), seconds = parseWorkoutDuration(duration);
      if (!start) throw new Error("Choose a valid workout date and time.");
      if (seconds === null) throw new Error("Enter duration as minutes:seconds, for example 70:00.");
      const updated = prepareCompletedWorkoutEdit(draft, { startedAt: start, durationSeconds: seconds });
      await saveWorkout(updated);
      const { getWorkoutById } = await import("@/features/workouts/repository");
      const saved = await getWorkoutById(updated.id);
      showToast("Workout changes saved.");
      onSaved(saved ?? updated);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not save this workout. Your edits are still here."); }
    finally { setSaving(false); }
  }
  function cancel() { if (!dirty || window.confirm("Discard your changes to this workout?")) onCancel(); }

  return <section className="workout-editor" aria-label="Edit saved workout" aria-busy={saving}>
    <header className="workout-editor-header"><button type="button" onClick={cancel} disabled={saving}>Cancel</button><h1>Edit workout</h1><button className="workout-editor-save" type="button" onClick={() => void save()} disabled={saving || uploading}>{saving ? <><LoaderCircle className="saving-spinner" size={16} aria-hidden="true"/> Saving…</> : "Save"}</button></header>
    <div className="workout-editor-body">
      {message && <p className="workout-editor-error" role="alert">{message}</p>}
      <label className="workout-editor-title"><span className="sr-only">Workout name</span><input aria-label="Workout name" maxLength={200} value={draft.name} placeholder="Workout name" onChange={event => setDraft({ ...draft, name: event.target.value })}/></label>
      <div className="workout-editor-stats"><label><span>Duration</span><input aria-label="Workout duration" value={duration} placeholder="70:00" inputMode="text" onChange={event => setDuration(event.target.value)}/><small>min:sec or hr:min:sec</small></label><div><span>Volume</span><strong>{formatWeight(totals.volume, preferences.units)}</strong></div><div><span>Sets</span><strong>{totals.sets}</strong></div></div>
      <input ref={fileRef} type="file" hidden accept="image/*,video/mp4,video/webm,video/quicktime" onChange={event => void attach(event.target.files?.[0])}/>
      <button className="workout-media-add" type="button" onClick={() => fileRef.current?.click()} disabled={uploading || (draft.media?.length ?? 0) >= MAX_WORKOUT_MEDIA}><ImagePlus size={26}/><span>{uploading ? "Preparing attachment…" : "Add a photo / video"}</span></button>
      <p className="workout-media-hint">Up to 3 attachments. Photos resize automatically; video clips up to 400 KB.</p>
      {!!draft.media?.length && <div className="workout-media-grid">{draft.media.map(media => <figure key={media.id}>{media.type === "image" ? <Image src={media.dataUrl} alt={media.name} width={1200} height={900} unoptimized/> : <video src={media.dataUrl} controls preload="metadata" playsInline/>}<figcaption>{media.name}</figcaption><button type="button" aria-label={`Remove ${media.name}`} onClick={() => setDraft({ ...draft, media: draft.media?.filter(item => item.id !== media.id) })}><X size={17}/></button></figure>)}</div>}
      <label className="workout-editor-description"><span>Description</span><textarea aria-label="Workout description" rows={3} maxLength={20000} value={draft.notes} onChange={event => setDraft({ ...draft, notes: event.target.value })} placeholder="How did your workout go? Leave some notes here…"/></label>
      <label className="workout-editor-detail"><CalendarDays size={23}/><span>Date</span><input aria-label="Workout date and time" type="datetime-local" value={startedAt} onChange={event => setStartedAt(event.target.value)}/></label>
      <div className="workout-editor-detail"><MapPin size={23}/><label className="sr-only" htmlFor="workout-location">Gym or location</label><input id="workout-location" maxLength={200} value={draft.location ?? ""} onChange={event => setDraft({ ...draft, location: event.target.value })} placeholder="Add a gym or location"/>{draft.location && <button type="button" aria-label="Clear gym or location" onClick={() => setDraft({ ...draft, location: "" })}><X size={20}/></button>}</div>
      <div className="workout-editor-private"><LockKeyhole size={19}/><span>Private workout</span><small>Only visible in your training log</small></div>
      <div className="workout-editor-exercises">{draft.exercises.map((exercise, exerciseIndex) => {
        const cardio = isCardioExercise(exercise), previous = previousExercises.get(exercise.exerciseId);
        return <article className="workout-edit-exercise" key={exercise.id}>
          <header><span className="workout-edit-exercise-icon">{cardio ? <Bike size={24}/> : <Dumbbell size={23}/>}</span><div><h2>{exercise.name}</h2><small>{exercise.muscle} · {exercise.equipment}</small></div><details className="workout-exercise-menu"><summary aria-label={`Options for ${exercise.name}`}><MoreVertical size={22}/></summary><div><button type="button" disabled={exerciseIndex === 0} onClick={() => moveExercise(exerciseIndex, -1)}><ArrowUp size={15}/> Move up</button><button type="button" disabled={exerciseIndex === draft.exercises.length - 1} onClick={() => moveExercise(exerciseIndex, 1)}><ArrowDown size={15}/> Move down</button><button type="button" onClick={() => setDraft({ ...draft, exercises: draft.exercises.filter(item => item.id !== exercise.id) })}><Trash2 size={15}/> Remove exercise</button></div></details></header>
          <textarea className="workout-exercise-notes" aria-label={`Notes for ${exercise.name}`} maxLength={4000} rows={1} placeholder="Add exercise notes…" value={exercise.notes ?? ""} onChange={event => changeExercise(exercise.id, { notes: event.target.value })}/>
          <div className="workout-exercise-settings"><label><Timer size={17}/><span>Rest</span><select aria-label={`Rest timer for ${exercise.name}`} value={exercise.restSeconds} onChange={event => changeExercise(exercise.id, { restSeconds: Number(event.target.value) })}>{[...new Set([0,30,60,70,90,120,150,180,240,300,exercise.restSeconds])].sort((a,b)=>a-b).map(seconds => <option key={seconds} value={seconds}>{seconds ? formatWorkoutDuration(seconds) : "Off"}</option>)}</select></label><label><span className="sr-only">Tracking for {exercise.name}</span><select aria-label={`Tracking for ${exercise.name}`} value={cardio ? "cardio" : "strength"} onChange={event => changeExercise(exercise.id, { trackingType: event.target.value as "strength" | "cardio" })}><option value="strength">Weight + reps</option><option value="cardio">Distance + time</option></select></label></div>
          <div className="workout-edit-table" role="group" aria-label={`Sets for ${exercise.name}`}><div className="workout-edit-columns"><span>Set</span><span>Previous</span><span>{cardio ? "KM" : weightUnit(preferences.units).toUpperCase()}</span><span>{cardio ? "Time" : "Reps"}</span><Check size={18}/></div>{exercise.sets.map((set, index) => {
            const oldSet = previous?.sets.filter(item => item.completed)[index];
            const previousLabel = oldSet ? cardio ? `${oldSet.distanceKm ?? "—"} km · ${formatWorkoutDuration(oldSet.durationSeconds ?? 0)}` : `${oldSet.weight === null ? "BW" : Number(toDisplayWeight(oldSet.weight, preferences.units).toFixed(1))} × ${oldSet.reps ?? "—"}` : "—";
            return <div className="workout-edit-set" key={set.id}><div className={`workout-edit-set-row ${set.completed ? "is-complete" : ""}`}><span className="workout-edit-set-number">{set.setType === "warmup" ? "W" : index + 1}</span><span className="workout-edit-previous">{previousLabel}</span><NumericInput aria-label={`${exercise.name} set ${index + 1} ${cardio ? "distance in km" : "weight"}`} min={0} max={cardio ? 10000 : toDisplayWeight(2000, preferences.units)} step="any" inputMode="decimal" placeholder={cardio ? "—" : "BW"} value={cardio ? set.distanceKm ?? "" : set.weight === null ? "" : Number(toDisplayWeight(set.weight, preferences.units).toFixed(2))} onChange={event => changeSet(exercise.id, set.id, cardio ? { distanceKm: numberValue(event.target.value) } : { weight: event.target.value === "" ? null : fromDisplayWeight(Number(event.target.value), preferences.units) })}/>{cardio ? <DurationInput value={set.durationSeconds ?? null} label={`${exercise.name} set ${index + 1} time`} onChange={value => changeSet(exercise.id, set.id, { durationSeconds: value })}/> : <NumericInput aria-label={`${exercise.name} set ${index + 1} reps`} min={0} max={10000} step={1} inputMode="numeric" placeholder="—" value={set.reps ?? ""} onChange={event => changeSet(exercise.id, set.id, { reps: numberValue(event.target.value) })}/>}<button className="workout-edit-complete" type="button" aria-label={`${set.completed ? "Unmark" : "Complete"} ${exercise.name} set ${index + 1}`} aria-pressed={set.completed} onClick={() => { const error = !set.completed ? setEntryError(set, exercise) : null; if (error) { setMessage(error); showToast(error, "error"); return; } changeSet(exercise.id, set.id, { completed: !set.completed, completedAt: set.completed ? null : draft.completedAt }); }}><Check size={20}/></button></div><details className="workout-set-options"><summary>Set options <ChevronRight size={13}/></summary><div><label>Type<select aria-label={`${exercise.name} set ${index + 1} type`} value={set.setType ?? "working"} onChange={event => changeSet(exercise.id, set.id, { setType: event.target.value as LoggedSet["setType"] })}>{["working","warmup","drop","failure","assisted","paused","amrap"].map(type => <option key={type} value={type}>{type}</option>)}</select></label><label>RPE<NumericInput aria-label={`${exercise.name} set ${index + 1} RPE`} min={0} max={10} step={.5} inputMode="decimal" value={set.rpe ?? ""} onChange={event => changeSet(exercise.id, set.id, { rpe: numberValue(event.target.value) })}/></label><label>RIR<NumericInput aria-label={`${exercise.name} set ${index + 1} RIR`} min={0} max={5} step={.5} inputMode="decimal" value={set.rir ?? ""} onChange={event => changeSet(exercise.id, set.id, { rir: numberValue(event.target.value) })}/></label><button type="button" aria-label={`Remove ${exercise.name} set ${index + 1}`} onClick={() => changeExercise(exercise.id, { sets: exercise.sets.filter(item => item.id !== set.id) })}><Trash2 size={17}/></button></div></details></div>;
          })}</div>
          <button className="workout-edit-add-set" type="button" onClick={() => changeExercise(exercise.id, { sets: [...exercise.sets, newSet(exercise.sets.length)] })}><Plus size={20}/> Add set</button>
        </article>;
      })}</div>
      <button className="workout-edit-add-exercise" type="button" onClick={() => setPickerOpen(open => !open)}><Plus size={20}/>{pickerOpen ? "Close exercise picker" : "Add exercise"}</button>
      {pickerOpen && <ExercisePicker catalog={catalog} preferences={pickerPreferences} addedIds={draft.exercises.map(exercise => exercise.exerciseId)} onAdd={addExercise} onClose={() => setPickerOpen(false)}/>}
      <p className="workout-editor-footnote">Changes save on this device first and sync when you’re signed in and online.</p>
    </div>
  </section>;
}

function DurationInput({ value, label, onChange }: { value: number | null; label: string; onChange: (value: number | null) => void }) {
  const [text, setText] = useState(value === null ? "" : formatWorkoutDuration(value));
  return <input aria-label={label} value={text} placeholder="mm:ss" inputMode="text" pattern="[0-9]+(:[0-9]{1,2}){0,2}" onChange={event => { setText(event.target.value); onChange(event.target.value === "" ? null : parseWorkoutDuration(event.target.value) ?? -1); }} onBlur={() => { if (value !== null && value >= 0) setText(formatWorkoutDuration(value)); }}/>;
}

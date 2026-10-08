import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { calculateWorkoutTotals, type WorkoutRecord } from "./model";
import { cacheWorkout,getWorkoutById } from "./repository";
import type { TrainingProgram } from "@/features/programs/model";
import type { PhysiqueEntry } from "@/features/physique/model";
import type { Exercise } from "@/features/exercises/catalog";
import { hardDeleteCustomExercise, hardDeleteProgram, hardDeletePhysiqueEntry, saveCustomExercise, saveProgram, savePhysiqueEntry } from "@/features/local-data/repository";

async function syncLibraryItem(kind:"program"|"measurement"|"exercise",payload:TrainingProgram|PhysiqueEntry|Exercise) {
  const response=await fetch("/api/sync/library",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({entries:[{kind,id:payload.id,payload,updatedAt:payload.updatedAt??new Date().toISOString()}]})});
  if(response.status===401)return false;
  if(!response.ok)throw new Error("Library sync is temporarily unavailable.");
  return true;
}

export async function syncCompletedWorkout(workout: WorkoutRecord): Promise<void> {
  if (workout.status !== "completed") return;
  workout=await getWorkoutById(workout.id)??workout;
  const portwaysResponse = await fetch("/api/sync/workout", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(workout) });
  if (portwaysResponse.ok) {
    const result=await portwaysResponse.json() as {accepted?:boolean};
    const current=await getWorkoutById(workout.id);
    if(result.accepted!==false&&current?.updatedAt===workout.updatedAt)await cacheWorkout({ ...current, syncStatus: "synced" });
    return;
  }
  if (portwaysResponse.status !== 401) {
    const payload = await portwaysResponse.json().catch(() => ({})) as { error?: string };
    throw new Error(payload.error ?? "Live workout database is unavailable.");
  }
  if (workout.location || workout.media?.length || workout.exercises.some(exercise => exercise.notes || exercise.trackingType === "cardio" || exercise.sets.some(set => set.distanceKm != null || set.durationSeconds != null))) {
    throw new Error("Sign in to your ARCUS account to sync the edited workout and its attachments.");
  }
  const supabase = createSupabaseBrowserClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("Sign in to sync completed workouts.");

  const totals = calculateWorkoutTotals(workout);
  const { error: workoutError } = await supabase.from("workouts").upsert({
    id: workout.id,
    user_id: user.id,
    name: workout.name || "Workout",
    started_at: workout.startedAt,
    completed_at: workout.completedAt,
    duration_seconds: totals.durationSeconds,
    status: "completed",
    notes: workout.notes || null,
    client_revision: Date.parse(workout.updatedAt) || Date.now(),
  }, { onConflict: "id" });
  if (workoutError) throw workoutError;

  const exerciseNames = [...new Set(workout.exercises.map((item) => item.name))];
  const exerciseIds = new Map<string, string>();
  if (exerciseNames.length) {
    const { data, error } = await supabase.from("exercises").select("id,name,slug").in("name", exerciseNames);
    if (error) throw error;
    for (const row of data ?? []) { exerciseIds.set(row.slug, row.id); exerciseIds.set(`name:${row.name}`, row.id); }
  }

  if (workout.exercises.length) {
    const workoutExercises = workout.exercises.map((exercise, index) => ({
      id: exercise.id,
      workout_id: workout.id,
      exercise_id: exerciseIds.get(exercise.exerciseId) ?? exerciseIds.get(`name:${exercise.name}`) ?? null,
      exercise_name_snapshot: exercise.name,
      order_index: index,
      rest_seconds: exercise.restSeconds,
    }));
    const { error } = await supabase.from("workout_exercises").upsert(workoutExercises, { onConflict: "id" });
    if (error) throw error;

    const sets = workout.exercises.flatMap((exercise) => exercise.sets.map((set, index) => ({
      id: set.id,
      workout_exercise_id: exercise.id,
      set_index: index,
      weight: set.weight,
      reps: set.reps,
      rpe: set.rpe,
      set_type: "working" as const,
      is_completed: set.completed,
      completed_at: set.completedAt,
    })));
    if (sets.length) {
      const { error: setsError } = await supabase.from("sets").upsert(sets, { onConflict: "id" });
      if (setsError) throw setsError;
    }
  }

  const current = await getWorkoutById(workout.id);
  if (current?.updatedAt === workout.updatedAt) await cacheWorkout({ ...current, syncStatus: "synced" });
}

export async function restoreWorkouts() {
  let offset:number|null=0;
  while(offset!==null){
    const response=await fetch(`/api/sync/workout?offset=${offset}`,{credentials:"include"});if(!response.ok)return;
    const data=await response.json() as {workouts:WorkoutRecord[];nextOffset:number|null};
    for(const workout of data.workouts){const current=await getWorkoutById(workout.id);if(!current||current.syncStatus==="synced")await cacheWorkout({...workout,syncStatus:"synced"});}
    offset=data.nextOffset;if(offset!==null)await new Promise(resolve=>setTimeout(resolve,1100));
  }
}

export async function syncProgram(program: TrainingProgram): Promise<void> {
  if(await syncLibraryItem("program",program)){await saveProgram({...program,syncStatus:"synced"});return;}
  const supabase = createSupabaseBrowserClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("Sign in to sync training programs.");
  if (program.deleted) {
    const { error: deleteError } = await supabase.from("programs").delete().eq("id", program.id);
    if (deleteError) throw deleteError;
    await hardDeleteProgram(program.id);
    return;
  }
  const { error } = await supabase.from("programs").upsert({ id: program.id, user_id: user.id, name: program.name, goal: program.goal, updated_at: program.updatedAt }, { onConflict: "id" });
  if (error) throw error;

  const days = program.days.map((day, index) => ({ id: day.id, program_id: program.id, week_index: day.weekIndex ?? 0, day_index: index, name: day.name }));
  if (days.length) {
    const { error: dayError } = await supabase.from("program_days").upsert(days, { onConflict: "id" });
    if (dayError) throw dayError;
  }
  const exerciseNames = [...new Set(program.days.flatMap((day) => day.exercises.map((exercise) => exercise.name)))];
  const exerciseIds = new Map<string, string>();
  if (exerciseNames.length) {
    const { data, error: exerciseError } = await supabase.from("exercises").select("id,name,slug").in("name", exerciseNames);
    if (exerciseError) throw exerciseError;
    for (const row of data ?? []) { exerciseIds.set(row.slug, row.id); exerciseIds.set(`name:${row.name}`, row.id); }
  }
  const items = program.days.flatMap((day) => day.exercises.map((exercise, index) => ({
    id: exercise.id,
    program_day_id: day.id,
    exercise_id: exerciseIds.get(exercise.exerciseId) ?? exerciseIds.get(`name:${exercise.name}`) ?? null,
    exercise_name_snapshot: exercise.name,
    order_index: index,
    target_sets: exercise.sets,
    rep_min: exercise.repMin,
    rep_max: exercise.repMax,
    rest_seconds: exercise.restSeconds,
    progression_method: exercise.progressionMethod,
    progression_config: { value: exercise.progressionValue },
  })));
  if (items.length) {
    const { error: itemError } = await supabase.from("program_day_exercises").upsert(items, { onConflict: "id" });
    if (itemError) throw itemError;
  }
  await saveProgram({ ...program, syncStatus: "synced" });
}

export async function syncPhysiqueEntry(entry: PhysiqueEntry): Promise<void> {
  if(await syncLibraryItem("measurement",entry)){await savePhysiqueEntry({...entry,syncStatus:"synced"});return;}
  const supabase = createSupabaseBrowserClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("Sign in to sync body measurements.");
  if (entry.deleted) {
    const result = entry.kind === "bodyweight"
      ? await supabase.from("bodyweight_entries").delete().eq("id", entry.id)
      : await supabase.from("body_measurements").delete().eq("id", entry.id);
    if (result.error) throw result.error;
    await hardDeletePhysiqueEntry(entry.id);
    return;
  }
  const result = entry.kind === "bodyweight"
    ? await supabase.from("bodyweight_entries").upsert({ id: entry.id, user_id: user.id, weight_kg: entry.value, measured_at: entry.measuredAt, notes: entry.notes || null }, { onConflict: "id" })
    : await supabase.from("body_measurements").upsert({ id: entry.id, user_id: user.id, metric: entry.metric, value_cm: entry.value, measured_at: entry.measuredAt, notes: entry.notes || null }, { onConflict: "id" });
  if (result.error) throw result.error;
  await savePhysiqueEntry({ ...entry, syncStatus: "synced" });
}

export async function syncCustomExercise(exercise: Exercise): Promise<void> {
  if(await syncLibraryItem("exercise",exercise)){await saveCustomExercise({...exercise,syncStatus:"synced"});return;}
  const supabase = createSupabaseBrowserClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user) throw new Error("Sign in to sync custom exercises.");
  if (exercise.deleted) {
    const { error } = await supabase.from("exercises").delete().eq("id", exercise.id);
    if (error) throw error;
    await hardDeleteCustomExercise(exercise.id);
    return;
  }
  const { data: muscle } = await supabase.from("muscles").select("id").eq("name", exercise.muscle).maybeSingle();
  const slugBase = exercise.name.toLocaleLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const { error } = await supabase.from("exercises").upsert({
    id: exercise.id,
    name: exercise.name,
    slug: `${slugBase || "custom-exercise"}-${exercise.id.slice(0, 8)}`,
    aliases: exercise.aliases,
    primary_muscle_id: muscle?.id ?? null,
    movement_pattern: exercise.pattern,
    equipment: [exercise.equipment],
    default_rest_seconds: exercise.restSeconds,
    is_system_exercise: false,
    created_by: user.id,
    is_archived: false,
  }, { onConflict: "id" });
  if (error) throw error;
  await saveCustomExercise({ ...exercise, syncStatus: "synced" });
}

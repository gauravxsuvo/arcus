import { type WorkoutRecord } from "./model";
import { cacheWorkout,getWorkoutById } from "./repository";
import type { TrainingProgram } from "@/features/programs/model";
import type { PhysiqueEntry } from "@/features/physique/model";
import type { Exercise } from "@/features/exercises/catalog";
import { hardDeleteCustomExercise, hardDeleteProgram, hardDeletePhysiqueEntry, saveCustomExercise, saveProgram, savePhysiqueEntry } from "@/features/local-data/repository";

async function syncLibraryItem(kind:"program"|"measurement"|"exercise",payload:TrainingProgram|PhysiqueEntry|Exercise) {
  const response=await fetch("/api/sync/library",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({entries:[{kind,id:payload.id,payload,updatedAt:payload.updatedAt??new Date().toISOString()}]})});
  if(response.status===401)throw new Error("Sign in to sync changes to your ARCUS account.");
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
  const payload = await portwaysResponse.json().catch(() => ({})) as { error?: string };
  throw new Error(payload.error ?? "Live workout database is unavailable.");
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
  if (program.deleted) { await syncLibraryItem("program", program); await hardDeleteProgram(program.id); return; }
  await syncLibraryItem("program",program);
  await saveProgram({ ...program, syncStatus: "synced" });
}

export async function syncPhysiqueEntry(entry: PhysiqueEntry): Promise<void> {
  await syncLibraryItem("measurement",entry);
  if (entry.deleted) { await hardDeletePhysiqueEntry(entry.id); return; }
  await savePhysiqueEntry({ ...entry, syncStatus: "synced" });
}

export async function syncCustomExercise(exercise: Exercise): Promise<void> {
  await syncLibraryItem("exercise",exercise);
  if (exercise.deleted) { await hardDeleteCustomExercise(exercise.id); return; }
  await saveCustomExercise({ ...exercise, syncStatus: "synced" });
}

"use client";
import { useState } from "react";
import { parseBackup } from "@/features/import-export/restore-schema";
import { getActiveWorkout,getCompletedWorkouts,saveWorkouts } from "@/features/workouts/repository";
import { getLocalSession,listCustomExercises,listExerciseSettings,listPhysiqueEntries,listPrograms,listRecaps,saveCustomExercise,saveDevicePreferences,saveExerciseSettings,savePhysiqueEntry,saveProgram,saveRecap,saveExercisePreference,updateLocalUser } from "@/features/local-data/repository";
import type { WorkoutRecord } from "@/features/workouts/model";
import type { TrainingProgram } from "@/features/programs/model";
import type { Exercise } from "@/features/exercises/catalog";
import { downloadText,serializeCsv } from "@/features/import-export/csv";
import { exerciseCatalog } from "@/features/exercises/catalog";

export function BackupRestore(){const [backup,setBackup]=useState<ReturnType<typeof parseBackup>|null>(null),[message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 async function read(file:File){setMessage("");setBackup(null);try{if(file.size>20*1024*1024)throw new Error("Choose a backup smaller than 20 MB.");setBackup(parseBackup(await file.text()));}catch(error){setMessage(error instanceof Error?error.message:"Could not read backup.");}}
 async function restore(){if(!backup)return;setBusy(true);try{
  const [workouts,active,programs,metrics,exercises,settings,recaps,user]=await Promise.all([getCompletedWorkouts(),getActiveWorkout(),listPrograms(),listPhysiqueEntries(),listCustomExercises(),listExerciseSettings(),listRecaps(),getLocalSession()]);const now=new Date().toISOString();
  const existingWorkouts=new Set([...workouts,...(active?[active]:[])].map(w=>w.id));const added=backup.workouts.filter(w=>!existingWorkouts.has(w.id)).map(w=>({...w,syncStatus:"pending" as const,updatedAt:now} as WorkoutRecord));
  if(backup.activeWorkout&&!active&&!existingWorkouts.has(backup.activeWorkout.id))added.push({...backup.activeWorkout,syncStatus:"pending",updatedAt:now} as WorkoutRecord);
  // Merge missing records only: current device records and active drafts take priority.
  for(const p of backup.programs)if(!programs.some(e=>e.id===p.id))await saveProgram({...p,syncStatus:"pending",updatedAt:now} as TrainingProgram);
  for(const m of backup.physique)if(!metrics.some(e=>e.id===m.id))await savePhysiqueEntry({...m,syncStatus:"pending",updatedAt:now});
  for(const e of backup.customExercises)if(!exercises.some(x=>x.id===e.id))await saveCustomExercise({...e,isCustom:true,syncStatus:"pending",updatedAt:now} as Exercise);
  for(const s of backup.exerciseSettings??[])if(!settings.some(x=>x.id===s.id))await saveExerciseSettings({...s,syncStatus:"pending",updatedAt:now});
  for(const r of backup.recaps??[])if(!recaps.some(x=>x.id===r.id))await saveRecap({...r,syncStatus:"pending",updatedAt:now});
  for(const p of backup.preferences??[])await saveExercisePreference({...p,updatedAt:now,syncStatus:"pending"});
  if(backup.devicePreferences)await saveDevicePreferences(backup.devicePreferences);
  if(user&&backup.profile?.id===user.id)await updateLocalUser({...user,profile:{...user.profile,...backup.profile.profile},syncStatus:"pending",updatedAt:now});
  await saveWorkouts(added);setMessage(`Restored ${added.length} workout records. Existing records and active drafts were preserved.${backup.profile&&user?.id!==backup.profile.id?" Profile details were skipped because they belong to a different account.":""}`);setBackup(null);
 }catch(error){setMessage(`${error instanceof Error?error.message:"Restore failed."} Restore merges by ID, so you can retry safely.`);}finally{setBusy(false);}}
 async function exportType(type:"exercises"|"metrics"){const today=new Date().toISOString().slice(0,10);if(type==="exercises"){const custom=await listCustomExercises();downloadText(`arcus-exercises-${today}.csv`,serializeCsv(["id","name","muscle","equipment","pattern","custom"],[...exerciseCatalog,...custom].map(e=>({...e,custom:e.isCustom??false}))),"text/csv;charset=utf-8");}else{const [entries,user]=await Promise.all([listPhysiqueEntries(),getLocalSession()]);downloadText(`arcus-body-metrics-${today}.csv`,serializeCsv(["date","metric","value","unit","body_fat_percent"],[...entries.map(e=>({date:e.measuredAt,metric:e.metric,value:e.value,unit:e.unit,body_fat_percent:""})),...(user?.profile.bodyMetricsHistory??[]).map(m=>({date:m.date,metric:"Bodyweight",value:m.weight,unit:"kg",body_fat_percent:m.bodyFat??""}))]),"text/csv;charset=utf-8");}}
 return <section className="feature-panel"><h2>Restore an ARCUS backup</h2><p className="feature-muted">Validate a JSON backup first, then merge missing records. Existing device records take priority. Passwords and sign-in sessions are never imported.</p><label className="upload-avatar-button">Choose JSON<input type="file" accept=".json,application/json" disabled={busy} onChange={e=>{const file=e.target.files?.[0];e.target.value="";if(file)void read(file);}}/></label>{backup&&<div className="backup-review"><p>{backup.workouts.length} workouts · {backup.programs.length} programs · {backup.physique.length} measurements · {backup.customExercises.length} custom exercises</p><button className="action-button" disabled={busy} onClick={()=>void restore()}>{busy?"Restoring…":"Confirm restore"}</button><button className="text-action" disabled={busy} onClick={()=>setBackup(null)}>Cancel</button></div>}<div className="feature-actions"><button className="outline-button" onClick={()=>void exportType("exercises")}>Export exercises CSV</button><button className="outline-button" onClick={()=>void exportType("metrics")}>Export body metrics CSV</button></div>{message&&<p role="status">{message}</p>}</section>;
}

import { listRecaps,saveRecap } from "@/features/local-data/repository";
import { getCompletedWorkouts } from "@/features/workouts/repository";
import { calculateWorkoutTotals } from "@/features/workouts/model";
import { consistency,dateKey,detectRecords,weekStartDate } from "@/features/training/logic";
import type { ProfilePreferences } from "@/features/profile/model";
export async function generateRecaps(preferences:ProfilePreferences){
 const [workouts,stored]=await Promise.all([getCompletedWorkouts(),listRecaps()]);
 const records=detectRecords(workouts);const generated=[];
 for(let offset=1;offset<=12;offset++){
  const start=weekStartDate(new Date(),preferences.weekStart);start.setDate(start.getDate()-offset*7);const end=new Date(start);end.setDate(end.getDate()+7);
  const sessions=workouts.filter(w=>Date.parse(w.completedAt??"")>=start.getTime()&&Date.parse(w.completedAt??"")<end.getTime());
  if(!sessions.length)continue;const ids=new Set(sessions.map(w=>w.id));const recap={id:`week-${preferences.weekStart}-${dateKey(start)}`,start:dateKey(start),end:dateKey(new Date(end.getTime()-1)),sessions:sessions.length,volume:sessions.reduce((sum,w)=>sum+calculateWorkoutTotals(w).volume,0),records:records.filter(r=>ids.has(r.workoutId)).length,streak:consistency(workouts,new Date(end.getTime()-1),preferences.weekStart).streak,updatedAt:new Date().toISOString(),syncStatus:"pending" as const};
  const old=stored.find(r=>r.id===recap.id);if(!old||old.sessions!==recap.sessions||old.volume!==recap.volume||old.records!==recap.records){await saveRecap(recap);if(!old)generated.push(recap);}
 }
 return generated;
}

import { getLocalSession, getPendingCustomExercises, getPendingPhysiqueEntries, getPendingPrograms, listExerciseSettings, listRecaps, saveCustomExercise, saveExerciseSettings, savePhysiqueEntry, saveProgram, saveRecap,getExercisePreferences,saveExercisePreference,type ExercisePreference } from "./repository";
import type { TrainingProgram } from "@/features/programs/model";
import type { Exercise } from "@/features/exercises/catalog";
import type { PhysiqueEntry } from "@/features/physique/model";
import type { ExerciseSettings, WeeklyRecap } from "@/features/profile/model";
type LibraryItem = {kind:"program";payload:TrainingProgram}|{kind:"measurement";payload:PhysiqueEntry}|{kind:"exercise";payload:Exercise}|{kind:"settings";payload:ExerciseSettings}|{kind:"recap";payload:WeeklyRecap}|{kind:"favorite";payload:ExercisePreference};
async function store(item:LibraryItem) { switch(item.kind){case "program":return saveProgram(item.payload);case "measurement":return savePhysiqueEntry(item.payload);case "exercise":return saveCustomExercise(item.payload);case "settings":return saveExerciseSettings(item.payload);case "recap":return saveRecap(item.payload);case "favorite":return saveExercisePreference(item.payload);} }
export async function flushLibrary() {
  if(!navigator.onLine||!await getLocalSession())return;
  const [programs,measurements,exercises,settings,recaps]=await Promise.all([getPendingPrograms(),getPendingPhysiqueEntries(),getPendingCustomExercises(),listExerciseSettings(),listRecaps()]);
  const items:LibraryItem[]=[...programs.map(payload=>({kind:"program" as const,payload})),...measurements.map(payload=>({kind:"measurement" as const,payload})),...exercises.map(payload=>({kind:"exercise" as const,payload})),...settings.filter(p=>p.syncStatus!=="synced").map(payload=>({kind:"settings" as const,payload})),...recaps.filter(p=>p.syncStatus!=="synced").map(payload=>({kind:"recap" as const,payload}))];
  const favorites=await getExercisePreferences();items.push(...favorites.filter(p=>p.syncStatus!=="synced").map(payload=>({kind:"favorite" as const,payload})));
  const snapshots=items.slice(0,20);if(!snapshots.length)return;
  const response=await fetch("/api/sync/library",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({entries:snapshots.map(item=>({...item,id:item.payload.id,updatedAt:"updatedAt" in item.payload?item.payload.updatedAt??new Date().toISOString():new Date().toISOString()}))})});
  if(!response.ok)return;
  const {accepted}=await response.json() as {accepted:{kind:string;id:string}[]};
  const [latestPrograms,latestMetrics,latestExercises,latestSettings,latestRecaps]=await Promise.all([getPendingPrograms(),getPendingPhysiqueEntries(),getPendingCustomExercises(),listExerciseSettings(),listRecaps()]);
  const latest=new Map<string,LibraryItem["payload"]>([...latestPrograms.map(payload=>[`program:${payload.id}`,payload] as const),...latestMetrics.map(payload=>[`measurement:${payload.id}`,payload] as const),...latestExercises.map(payload=>[`exercise:${payload.id}`,payload] as const),...latestSettings.map(payload=>[`settings:${payload.id}`,payload] as const),...latestRecaps.map(payload=>[`recap:${payload.id}`,payload] as const)]);
  for(const favorite of await getExercisePreferences())latest.set(`favorite:${favorite.id}`,favorite);
  for(const item of snapshots)if(accepted.some(a=>a.kind===item.kind&&a.id===item.payload.id)&&JSON.stringify(latest.get(`${item.kind}:${item.payload.id}`))===JSON.stringify(item.payload))await store({...item,payload:{...item.payload,syncStatus:"synced"}} as LibraryItem);
}
export async function restoreLibrary() {
  let offset:number|null=0;
  while(offset!==null){
    const response=await fetch(`/api/sync/library?offset=${offset}`,{credentials:"include"});if(!response.ok)return;
    const data=await response.json() as {entries:LibraryItem[];nextOffset:number|null};
    const [programs,metrics,exercises,settings,recaps]=await Promise.all([getPendingPrograms(),getPendingPhysiqueEntries(),getPendingCustomExercises(),listExerciseSettings(),listRecaps()]);
    const pending=new Set([...programs.map(p=>`program:${p.id}`),...metrics.map(p=>`measurement:${p.id}`),...exercises.map(p=>`exercise:${p.id}`),...settings.filter(p=>p.syncStatus!=="synced").map(p=>`settings:${p.id}`),...recaps.filter(p=>p.syncStatus!=="synced").map(p=>`recap:${p.id}`)]);
    for(const favorite of await getExercisePreferences())if(favorite.syncStatus!=="synced")pending.add(`favorite:${favorite.id}`);
    for(const item of data.entries)if(!pending.has(`${item.kind}:${item.payload.id}`))await store({...item,payload:{...item.payload,syncStatus:"synced"}} as LibraryItem);
    offset=data.nextOffset;if(offset!==null)await new Promise(resolve=>setTimeout(resolve,1000));
  }
}

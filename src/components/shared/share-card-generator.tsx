"use client";
import { useState } from "react";
import { calculateWorkoutTotals,type WorkoutRecord } from "@/features/workouts/model";
import { formatWeight } from "@/features/training/logic";
import { useProfile } from "./user-profile-provider";
import { getCompletedWorkouts } from "@/features/workouts/repository";
import { detectRecords } from "@/features/training/logic";
export function ShareCard({workout}:{workout:WorkoutRecord}){
 const {preferences}=useProfile();const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
 async function generate(share:boolean){setBusy(true);setMessage("");try{
  const totals=calculateWorkoutTotals(workout),records=detectRecords(await getCompletedWorkouts()).filter(r=>r.workoutId===workout.id).length;
  const canvas=document.createElement("canvas");canvas.width=1080;canvas.height=620+workout.exercises.length*72;
  const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Image generation is unavailable.");
  ctx.fillStyle="#0a0a0a";ctx.fillRect(0,0,canvas.width,canvas.height);
  try{const mark=new Image();mark.src="/arcus-mark.svg";await mark.decode();ctx.drawImage(mark,64,64,56,56);}catch{/* Wordmark still identifies the card if offline icon loading fails. */}
  ctx.fillStyle="#ededed";ctx.font="bold 40px Arial";ctx.fillText("ARCUS.",144,106);ctx.font="20px monospace";ctx.fillStyle="#aaa";ctx.fillText("TRAINING, MADE MEASURABLE.",64,160);
  ctx.font="bold 44px Arial";ctx.fillStyle="#ededed";ctx.fillText(workout.name.slice(0,38),64,256);ctx.font="24px Arial";ctx.fillStyle="#aaa";ctx.fillText(new Date(workout.completedAt??workout.startedAt).toLocaleDateString(undefined,{dateStyle:"long"}),64,302);
  const stats=[`${Math.round(totals.durationSeconds/60)} min`,formatWeight(totals.volume,preferences.units),`${workout.exercises.length} exercises`,`${records} PRs`];
  ctx.fillStyle="#181818";ctx.fillRect(64,350,952,110);ctx.font="bold 24px Arial";ctx.fillStyle="#91b8ff";stats.forEach((s,i)=>ctx.fillText(s,88+i*230,416));
  workout.exercises.forEach((exercise,index)=>{const sets=exercise.sets.filter(s=>s.completed&&s.setType!=="warmup"),top=[...sets].sort((a,b)=>(b.weight??0)-(a.weight??0)||(b.reps??0)-(a.reps??0))[0];ctx.fillStyle="#ededed";ctx.font="24px Arial";ctx.fillText(exercise.name.slice(0,50),64,530+index*72);ctx.fillStyle="#aaa";ctx.font="20px monospace";ctx.fillText(`${sets.length} sets · ${top?`${top.weight===null?"BW":formatWeight(top.weight,preferences.units)} × ${top.reps??0}`:"No completed sets"}`,64,559+index*72);});
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error("Could not create the share image.")),"image/png"));const file=new File([blob],"arcus-workout.png",{type:"image/png"});
  if(share&&navigator.canShare?.({files:[file]})){await navigator.share({files:[file],title:workout.name});}else{const url=URL.createObjectURL(blob),link=document.createElement("a");link.href=url;link.download="arcus-workout.png";link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setMessage("Workout card downloaded.");}
 }catch(error){if(!(error instanceof DOMException&&error.name==="AbortError"))setMessage(error instanceof Error?error.message:"Could not share.");}finally{setBusy(false);}}
 return <div className="share-card-actions"><button type="button" className="outline-button" disabled={busy} onClick={()=>void generate(true)}>{busy?"Creating card…":"Share workout"}</button><button type="button" className="text-action" disabled={busy} onClick={()=>void generate(false)}>Download PNG</button>{message&&<small role="status">{message}</small>}</div>;
}

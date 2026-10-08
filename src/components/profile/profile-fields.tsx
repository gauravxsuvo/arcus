"use client";
import { NumericInput } from "@/components/shared/numeric-input";
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { DEFAULT_PREFERENCES, type TrainingGoal, type UserProfile } from "@/features/profile/model";
import { exerciseCatalog, type Exercise } from "@/features/exercises/catalog";
import { listCustomExercises } from "@/features/local-data/repository";
import { getCompletedWorkouts } from "@/features/workouts/repository";
import type { WorkoutRecord } from "@/features/workouts/model";
import { dateKey, fromDisplayWeight, toDisplayWeight, formatWeight, goalProgress, weightUnit } from "@/features/training/logic";

export function ProfileFields({profile,onChange}:{profile:UserProfile;onChange:(profile:UserProfile)=>void}) {
  const [catalog,setCatalog]=useState<Exercise[]>(exerciseCatalog);
  const [history,setHistory]=useState<WorkoutRecord[]>([]);
  useEffect(()=>{void Promise.all([listCustomExercises(),getCompletedWorkouts()]).then(([custom,workouts])=>{setCatalog([...exerciseCatalog,...custom]);setHistory(workouts);}).catch(()=>undefined);},[]);
  const prefs={...DEFAULT_PREFERENCES,...profile.preferences}; const units=prefs.units;
  const metrics=profile.bodyMetrics??{weight:null,bodyFat:null}; const goals=profile.targetGoals??[];
  const height=profile.height_cm??0;
  const inches=Math.round(height/2.54); const feet=Math.floor(inches/12);
  const changeGoal=(id:string,change:Partial<TrainingGoal>)=>onChange({...profile,targetGoals:goals.map(g=>g.id===id?{...g,...change}:g)});
  const addGoal=(type:TrainingGoal["type"])=>{const date=new Date();date.setMonth(date.getMonth()+3);onChange({...profile,targetGoals:[...goals,{id:crypto.randomUUID(),type,exerciseId:type==="lift"?(catalog.find(e=>e.id==="barbell-bench-press")??catalog[0]).id:undefined,targetValue:type==="lift"?100:metrics.weight??75,targetReps:type==="lift"?5:undefined,startValue:type==="bodyweight"?metrics.weight??undefined:undefined,targetDate:dateKey(date),createdAt:new Date().toISOString()}]});};
  let age:number|null=null;
  if(profile.dateOfBirth){const birth=new Date(`${profile.dateOfBirth}T12:00:00`),now=new Date();age=now.getFullYear()-birth.getFullYear()-(now.getMonth()<birth.getMonth()||(now.getMonth()===birth.getMonth()&&now.getDate()<birth.getDate())?1:0);}
  return <>
    <fieldset className="training-level"><legend>Training level</legend>{[["beginner","Beginner","Less than 1 year of consistent training"],["intermediate","Intermediate","1–3 years of consistent training"],["advanced","Advanced","3+ years of consistent training"]].map(([value,label,description])=><label key={value}><input type="radio" name="experience" value={value} checked={(profile.experience??"beginner")===value} onChange={()=>onChange({...profile,experience:value})}/><span>{label}<small>{description}</small></span></label>)}</fieldset>
    <section className="profile-form-section"><h2>Body metrics</h2><p className="feature-muted">Your measurements are saved with a dated snapshot every time you save your profile.</p><div className="profile-form-grid">
      <label>Current weight · {weightUnit(units)}<NumericInput min={Math.ceil(toDisplayWeight(20,units)*10)/10} max={Math.floor(toDisplayWeight(500,units)*10)/10} step="0.1" value={metrics.weight===null?"":Number(toDisplayWeight(metrics.weight,units).toFixed(1))} onChange={e=>onChange({...profile,bodyMetrics:{...metrics,weight:e.target.value===""?null:fromDisplayWeight(Number(e.target.value),units)}})}/></label>
      <label>Body fat · %<NumericInput min="0" max="60" step="0.1" value={metrics.bodyFat??""} onChange={e=>onChange({...profile,bodyMetrics:{...metrics,bodyFat:e.target.value===""?null:Number(e.target.value)}})}/></label>
      {units==="metric"?<label>Height · cm<NumericInput min="80" max="250" step="0.1" value={profile.height_cm??""} onChange={e=>onChange({...profile,height_cm:e.target.value===""?null:Number(e.target.value)})}/></label>:<fieldset className="height-pair"><legend>Height · feet and inches</legend><label>Feet<NumericInput min="2" max="8" value={height?feet:""} onChange={e=>onChange({...profile,height_cm:(Number(e.target.value)*12+inches%12)*2.54})}/></label><label>Inches<NumericInput min="0" max="11" value={height?inches%12:""} onChange={e=>onChange({...profile,height_cm:(feet*12+Number(e.target.value))*2.54})}/></label></fieldset>}
      <label>Date of birth<input type="date" max={dateKey(new Date())} value={profile.dateOfBirth??""} onChange={e=>onChange({...profile,dateOfBirth:e.target.value||null})}/><small>{age!==null?`${age} years old`:"Optional"}</small></label>
    </div></section>
    <section className="profile-form-section"><h2>Training preferences</h2><div className="profile-form-grid">
      <label>Unit system<select value={prefs.units} onChange={e=>onChange({...profile,preferences:{...prefs,units:e.target.value as typeof units}})}><option value="metric">Metric · kg / cm</option><option value="imperial">Imperial · lb / ft + in</option></select></label>
      <label>Default rest · seconds<NumericInput min="0" max="1800" value={prefs.defaultRestTimer} onChange={e=>onChange({...profile,preferences:{...prefs,defaultRestTimer:Number(e.target.value)}})}/></label>
      <label>Theme<select value={prefs.theme} onChange={e=>onChange({...profile,preferences:{...prefs,theme:e.target.value as "dark"|"light"}})}><option value="dark">Dark</option><option value="light">Light</option></select></label>
      <label>Week starts on<select value={prefs.weekStart} onChange={e=>onChange({...profile,preferences:{...prefs,weekStart:e.target.value as "monday"|"sunday"}})}><option value="monday">Monday</option><option value="sunday">Sunday</option></select></label>
      <label>Effort logging<select value={prefs.effortSystem} onChange={e=>onChange({...profile,preferences:{...prefs,effortSystem:e.target.value as "rpe"|"rir"}})}><option value="rpe">RPE · effort from 1–10</option><option value="rir">RIR · reps left from 0–5</option></select></label>
    </div></section>
    <section className="profile-form-section" id="goals"><h2>Training targets</h2><p className="feature-muted">Track a bodyweight target or a lift at your chosen rep count.</p>
      {goals.map(g=>{const progress=goalProgress(g,profile,history);return <article key={g.id} className="goal-editor"><div className="profile-form-grid">
        {g.type==="lift"?<label>Exercise<select value={g.exerciseId} onChange={e=>changeGoal(g.id,{exerciseId:e.target.value})}>{catalog.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label>:<strong>Bodyweight target</strong>}
        <label>Target · {weightUnit(units)}<NumericInput min="0.1" step="0.1" required value={Number(toDisplayWeight(g.targetValue,units).toFixed(1))} onChange={e=>changeGoal(g.id,{targetValue:fromDisplayWeight(Number(e.target.value),units)})}/></label>
        {g.type==="lift"&&<label>Target reps<NumericInput min="1" max="100" value={g.targetReps??1} onChange={e=>changeGoal(g.id,{targetReps:Number(e.target.value)})}/></label>}
        <label>Target date<input type="date" required value={g.targetDate} onChange={e=>changeGoal(g.id,{targetDate:e.target.value})}/></label>
      </div><div className="goal-progress"><progress max="100" value={progress.percent}/><small>{formatWeight(progress.value,units)} current · {Math.round(progress.percent)}%</small><button type="button" className="icon-button" aria-label="Remove goal" onClick={()=>onChange({...profile,targetGoals:goals.filter(x=>x.id!==g.id)})}><Trash2 size={16}/></button></div></article>;})}
      <div className="feature-actions"><button type="button" className="outline-button" disabled={goals.length>=30} onClick={()=>addGoal("bodyweight")}><Plus size={15}/> Bodyweight target</button><button type="button" className="outline-button" disabled={goals.length>=30} onClick={()=>addGoal("lift")}><Plus size={15}/> Lift target</button></div>
    </section>
  </>;
}

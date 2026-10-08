"use client";
import { useState } from "react";
import type { WorkoutExercise } from "@/features/workouts/model";
export function GroupExercises({exercises,onChange}:{exercises:WorkoutExercise[];onChange:(items:WorkoutExercise[])=>void}) {
  const [selected,setSelected]=useState<string[]>([]);
  const group=()=>{if(selected.length<2||selected.length>5)return;const groupId=crypto.randomUUID();onChange(exercises.map(e=>selected.includes(e.id)?{...e,groupId}:e));setSelected([]);};
  return <details className="feature-panel"><summary>Group exercises · superset / circuit</summary><p className="feature-muted">Select 2–5 movements. Rest starts after the full round.</p><div className="group-options">{exercises.map(e=><label key={e.id}><input type="checkbox" checked={selected.includes(e.id)} disabled={!selected.includes(e.id)&&selected.length===5} onChange={()=>setSelected(current=>current.includes(e.id)?current.filter(id=>id!==e.id):[...current,e.id])}/>{e.name}</label>)}</div><div className="feature-actions"><button type="button" className="outline-button" disabled={selected.length<2} onClick={group}>Create {selected.length===2?"superset":selected.length===3?"tri-set":"circuit"}</button><button type="button" className="text-action" disabled={!selected.length} onClick={()=>{onChange(exercises.map(e=>selected.includes(e.id)?{...e,groupId:undefined}:e));setSelected([]);}}>Ungroup selected</button></div></details>;
}
export function GroupedExercises({exercises,render}:{exercises:WorkoutExercise[];render:(exercise:WorkoutExercise,index:number)=>React.ReactNode}) {
  const groups=new Map<string,WorkoutExercise[]>();
  for(const exercise of exercises){const id=exercise.groupId??exercise.id;groups.set(id,[...(groups.get(id)??[]),exercise]);}
  return <>{[...groups.entries()].map(([id,items])=>items[0].groupId?<section className="superset-group" key={id}><p className="eyebrow">{items.length===2?"SUPERSET":items.length===3?"TRI-SET":"CIRCUIT"} · {items.length} EXERCISES</p>{items.map(e=>render(e,exercises.indexOf(e)))}</section>:render(items[0],exercises.indexOf(items[0])))}</>;
}

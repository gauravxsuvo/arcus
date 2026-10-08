"use client";
import Link from "next/link";
import { useProfile } from "./user-profile-provider";
import { exerciseCatalog } from "@/features/exercises/catalog";
import type { WorkoutRecord } from "@/features/workouts/model";
import { goalProgress,formatWeight } from "@/features/training/logic";
export function GoalSummary({workouts,limit=3}:{workouts:WorkoutRecord[];limit?:number}){const {user,preferences}=useProfile();const goals=user?.profile.targetGoals??[];return <section className="feature-panel"><div className="panel-heading"><h2>Active targets</h2><Link className="text-action" href="/profile/edit#goals">Edit goals →</Link></div>{goals.length?goals.slice(0,limit).map(g=>{const p=goalProgress(g,user?.profile??null,workouts);return <article className="goal-summary-row" key={g.id}><strong>{g.type==="bodyweight"?"Bodyweight":exerciseCatalog.find(e=>e.id===g.exerciseId)?.name??"Lift target"}</strong><small>{formatWeight(p.value,preferences.units)} / {formatWeight(g.targetValue,preferences.units)}{g.targetReps?` × ${g.targetReps} reps`:""} · by {g.targetDate}</small><progress value={p.percent} max="100" aria-label="Goal progress"/></article>;}):<p className="feature-muted">Set a bodyweight or lift target to see progress here.</p>}</section>;}

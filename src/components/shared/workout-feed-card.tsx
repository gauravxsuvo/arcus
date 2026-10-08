"use client";

import { useProfile } from "./user-profile-provider";
import { Avatar } from "./avatar";
import { formatWeight } from "@/features/training/logic";
import { useState } from "react";
import Link from "next/link";
import { Award, ChevronDown, Dumbbell } from "lucide-react";
import { calculateWorkoutTotals, type WorkoutRecord } from "@/features/workouts/model";

function formatDuration(seconds: number) {
  if (!seconds) return "—";
  const minutes = Math.round(seconds / 60);
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} min`;
}

export function WorkoutFeedCard({ workout, athlete, records = 0 }: { workout: WorkoutRecord; athlete: string; records?: number }) {
  const {preferences}=useProfile();
  const [expanded, setExpanded] = useState(false);
  const totals = calculateWorkoutTotals(workout);
  const workoutName = workout.name?.toLocaleLowerCase() === "imported workout" ? "Workout" : workout.name || "Workout";
  const visibleExercises = expanded ? workout.exercises : workout.exercises.slice(0, 3);
  const date = new Date(workout.completedAt ?? workout.startedAt);

  return <article className="activity-card">
    <header className="activity-author">
      <span className="athlete-avatar" aria-hidden="true"><Avatar size={40}/></span>
      <span className="activity-author-copy"><strong>{athlete || "Athlete"}</strong><small suppressHydrationWarning>{date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</small></span>
      <Link className="activity-date-link" href={`/history/${workout.id}`} aria-label="Open workout history">•••</Link>
    </header>
    <Link className="activity-title" href={`/history/${workout.id}`}><h2>{workoutName}</h2></Link>
    <div className="activity-stats">
      <div><span>Time</span><strong>{formatDuration(totals.durationSeconds)}</strong></div>
      <div><span>Volume</span><strong>{formatWeight(totals.volume,preferences.units)}</strong></div>
      <div><span>Records</span><strong className="activity-records"><Award size={17} fill="currentColor" aria-hidden="true"/>{records}</strong></div>
    </div>
    <div className="activity-exercises">
      {visibleExercises.map((exercise) => <div className="activity-exercise" key={exercise.id}>
        <span className="activity-exercise-icon"><Dumbbell size={18} aria-hidden="true"/></span>
        <span><strong>{exercise.sets.filter((set) => set.completed).length} sets</strong> {exercise.name}</span>
      </div>)}
      {workout.exercises.length > 3 && <button className="activity-expand" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}>{expanded ? "Show fewer exercises" : `See ${workout.exercises.length - 3} more exercises`}<ChevronDown size={15} className={expanded ? "rotate-chevron" : ""}/></button>}
    </div>
    <footer className="activity-footer"><Link href={`/history/${workout.id}`}>View session details <span aria-hidden="true">→</span></Link><span>{workout.syncStatus === "synced" ? "Synced" : "Saved on this device"}</span></footer>
  </article>;
}

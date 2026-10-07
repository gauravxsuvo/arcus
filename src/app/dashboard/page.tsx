"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Activity, ArrowUpRight, CalendarDays, ChevronRight, Dumbbell, History, Play, Plus, Sparkles } from "lucide-react";
import { calculateWorkoutTotals, type WorkoutRecord } from "@/features/workouts/model";
import { getActiveWorkout, getCompletedWorkouts } from "@/features/workouts/repository";

export default function DashboardPage() {
  const [active, setActive] = useState<WorkoutRecord | null>(null);
  const [history, setHistory] = useState<WorkoutRecord[]>([]);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void Promise.all([getActiveWorkout(), getCompletedWorkouts()]).then(([current, history]) => {
      if (!cancelled) { setActive(current); setHistory(history); setReady(true); }
    }).catch(() => { if (!cancelled) setReady(true); });
    return () => { cancelled = true; };
  }, []);

  const weekStart = new Date();
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const thisWeek = history.filter((workout) => Date.parse(workout.completedAt ?? "") >= weekStart.getTime());
  const weeklyVolume = thisWeek.reduce((sum, workout) => sum + calculateWorkoutTotals(workout).volume, 0);
  const recent = history.slice(0, 3);

  return <main className="dashboard-shell">
    <header className="dashboard-top"><Link className="brand" href="/"><span className="brand-mark">F</span><span>FORGE<span className="brand-period">.</span></span></Link><nav className="main-nav" aria-label="Main navigation"><Link className="nav-active" href="/dashboard">Today</Link><Link href="/workout">Train</Link><Link href="/programs">Programs</Link><Link href="/history">History</Link><Link href="/exercises">Exercises</Link><Link href="/progress">Progress</Link><Link href="/profile">Profile</Link></nav><span className="offline-badge"><span /> DEVICE SAVED</span></header>
    <section className="dashboard-welcome"><div><p className="eyebrow"><span className="live-dot" /> YOUR TRAINING SPACE</p><h1>Make today<br /><span>count.</span></h1><p className="dashboard-subtitle">A clear place to begin, and a record of what you’ve done.</p></div><div className="date-card"><CalendarDays size={18} /><div><span>TODAY</span><strong>{new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date())}</strong></div></div></section>

    {active && <Link href="/workout" className="resume-card"><div className="resume-icon"><Play size={18} fill="currentColor" /></div><div className="resume-copy"><span>WORKOUT IN PROGRESS</span><strong>{active.name || "Workout"}</strong><small>{active.exercises.length} exercises · started {new Date(active.startedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</small></div><span className="resume-action">Resume <ChevronRight size={16} /></span></Link>}

    <section className="today-grid"><article className="today-card featured-today"><div className="today-card-top"><span className="card-label">TODAY’S TRAINING</span><span className="card-index">01</span></div><div className="today-art"><div className="art-ring ring-one"/><div className="art-ring ring-two"/><Dumbbell size={32}/></div><div className="today-card-bottom"><div><h2>{active ? "Keep your momentum." : "Ready when you are."}</h2><p>{active ? "Pick up right where you left off." : "Start with an empty session and build it as you go."}</p></div><Link className="circle-arrow" href="/workout" aria-label={active ? "Resume workout" : "Start workout"}>{active ? <Play size={17} fill="currentColor"/> : <ArrowUpRight size={20}/>}</Link></div></article>
      <div className="quick-actions"><p className="card-label">QUICK START</p><Link className="quick-action" href="/workout"><span className="quick-icon"><Plus size={17}/></span><span><strong>Empty workout</strong><small>Choose exercises as you go</small></span><ChevronRight size={16}/></Link><Link className="quick-action" href="/programs"><span className="quick-icon"><CalendarDays size={17}/></span><span><strong>Follow a program</strong><small>Build and run a training week</small></span><ChevronRight size={16}/></Link><Link className="quick-action" href="/exercises"><span className="quick-icon"><Dumbbell size={17}/></span><span><strong>Browse exercises</strong><small>Find a movement to train</small></span><ChevronRight size={16}/></Link><Link className="quick-action" href="/progress"><span className="quick-icon"><Activity size={17}/></span><span><strong>Log physique & progress</strong><small>Review trends and measurements</small></span><ChevronRight size={16}/></Link></div>
    </section>

      <section className="dashboard-lower"><div className="recent-panel"><div className="panel-heading"><div><p className="eyebrow">THE WORK ADDS UP</p><h2>Recent sessions</h2></div><Link className="view-all" href="/history">View all <ArrowUpRight size={15}/></Link></div>{!ready ? <p className="subtle-copy">Loading your training log…</p> : recent.length === 0 ? <div className="recent-empty"><span className="empty-mark"><History size={19}/></span><p>Your finished sessions will show up here.</p></div> : recent.map((workout) => <Link className="recent-row" key={workout.id} href="/history"><span className="recent-icon"><Activity size={16}/></span><span className="recent-name"><strong>{workout.name || "Workout"}</strong><small>{new Date(workout.completedAt ?? workout.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {workout.exercises.length} exercises · {workout.syncStatus === "synced" ? "Synced" : "On device"}</small></span><span className="recent-volume">{calculateWorkoutTotals(workout).volume.toLocaleString()} <small>kg</small></span><ChevronRight size={16}/></Link>)}</div>
      <aside className="week-panel"><div className="week-icon"><Sparkles size={18}/></div><p className="card-label">THIS WEEK</p><div className="week-stat"><strong>{thisWeek.length}</strong><span>SESSIONS<br/>COMPLETED</span></div><div className="week-divider"/><div className="week-stat volume-stat"><strong>{weeklyVolume.toLocaleString()}</strong><span>KG LOGGED<br/>THIS WEEK</span></div><p className="week-note">Built from your completed sessions on this device.</p></aside></section>
    <footer className="dashboard-footer"><span>FORGE TRAINING SYSTEM</span><span>KEEP SHOWING UP.</span></footer>
  </main>;
}

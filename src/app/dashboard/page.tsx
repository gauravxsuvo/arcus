"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Award, BarChart3, ChevronRight, Dumbbell, History, Play, Search, Upload } from "lucide-react";
import { calculateWorkoutTotals, type WorkoutRecord } from "@/features/workouts/model";
import { getActiveWorkout, getCompletedWorkouts } from "@/features/workouts/repository";
import { WorkoutFeedCard } from "@/components/shared/workout-feed-card";
import { AccountAccess } from "@/components/shared/account-access";
import { TodayOverview } from "@/components/dashboard/today-overview";
import { QuickStart } from "@/components/dashboard/quick-start";
import { Avatar } from "@/components/shared/avatar";
import { ArcusMark } from "@/components/shared/arcus-mark";
import { useProfile } from "@/components/shared/user-profile-provider";
import { weekStartDate, formatWeight, detectRecords, toDisplayWeight, weightUnit } from "@/features/training/logic";
import styles from "./dashboard.module.css";

export default function DashboardPage() {
  const { preferences, user } = useProfile();
  const [active, setActive] = useState<WorkoutRecord | null>(null);
  const [history, setHistory] = useState<WorkoutRecord[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const athlete = user?.name || user?.username || "Athlete";
  const dataReady = ready && !error;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [current, sessions] = await Promise.all([getActiveWorkout(), getCompletedWorkouts()]);
        if (!cancelled) { setActive(current); setHistory(sessions); setError(""); setReady(true); }
      } catch {
        if (!cancelled) { setError("Your training log couldn’t load. Try again to restore your workouts."); setReady(true); }
      }
    };
    void load();
    window.addEventListener("focus", load);
    return () => { cancelled = true; window.removeEventListener("focus", load); };
  }, [refreshKey]);

  const recordsByWorkout = useMemo(() => {
    const counts = new Map<string, number>();
    for (const record of detectRecords(history)) counts.set(record.workoutId, (counts.get(record.workoutId) ?? 0) + 1);
    return counts;
  }, [history]);
  const now = new Date();
  const weekStart = weekStartDate(now, preferences.weekStart);
  const thisWeek = history.filter(workout => {
    const timestamp = Date.parse(workout.completedAt ?? "");
    return timestamp >= weekStart.getTime() && timestamp <= now.getTime();
  });
  const weeklyVolume = thisWeek.reduce((sum, workout) => sum + calculateWorkoutTotals(workout).volume, 0);
  const displayVolume = toDisplayWeight(weeklyVolume, preferences.units);
  const volumeLabel = new Intl.NumberFormat(undefined, { notation: displayVolume >= 10000 ? "compact" : "standard", maximumFractionDigits: displayVolume >= 10000 ? 1 : 0 }).format(displayVolume);
  const weeklyRecords = thisWeek.reduce((sum, workout) => sum + (recordsByWorkout.get(workout.id) ?? 0), 0);
  const activeTotals = active ? calculateWorkoutTotals(active) : null;

  return <main className={`social-shell home-shell ${styles.page}`}>
    <header className={styles.header}>
      <div><Link href="/welcome" className={styles.brand}><ArcusMark size={23}/><span>ARCUS TRAINING</span></Link><h1>Home</h1><p suppressHydrationWarning>{now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p></div>
      <div className={styles.headerActions}><Link className={styles.search} href="/exercises" aria-label="Search exercises"><Search size={21}/></Link><Link className={styles.avatar} href="/profile" aria-label="Open your profile"><Avatar size={44}/></Link></div>
    </header>
    <AccountAccess className={styles.account} description="Keep your progress backed up."/>
    {error && <div className={styles.error} role="alert"><p>{error}</p><button type="button" onClick={() => setRefreshKey(value => value + 1)}>Try again</button></div>}
    <section className={styles.hero} aria-labelledby="home-training-title">
      <div className={styles.heroTop}><span className={styles.trainingBadge}><span/>{active ? "WORKOUT IN PROGRESS" : "YOUR NEXT SESSION"}</span><span className={styles.heroIcon}><Dumbbell size={24}/></span></div>
      <h2 id="home-training-title">{active ? active.name || "Your workout" : history.length ? "Keep your momentum." : "Make today count."}</h2>
      <p>{active ? `${active.exercises.length} exercises · ${activeTotals?.sets ?? 0} sets logged. Pick up where you left off.` : history.length ? "A little progress, one session at a time. Your log is ready." : "Start simple. Choose your exercises and log your first sets."}</p>
      <Link className={styles.primary} href="/workout">{active ? <Play size={18} fill="currentColor"/> : <Dumbbell size={19}/>}<span>{active ? "Resume workout" : "Start a workout"}</span><ArrowRight size={19}/></Link>
      {!active && <Link className={styles.heroSecondary} href="/programs">Want a plan? Explore programs <ChevronRight size={14}/></Link>}
    </section>
    <section className={styles.weekSummary} aria-label="This week’s training summary">
      <div className={styles.sectionLabel}><h2>This week</h2><Link href="/progress">View progress <ArrowRight size={14}/></Link></div>
      <div className={styles.metrics}>
        <Link href="/history" className={styles.metric} aria-label={dataReady ? `${thisWeek.length} sessions this week` : "Weekly sessions unavailable"}><span className={styles.metricIcon}><Dumbbell size={17}/></span><strong>{dataReady ? thisWeek.length : "—"}</strong><span>Sessions</span></Link>
        <Link href="/progress" className={styles.metric} aria-label={dataReady ? `Weekly volume: ${formatWeight(weeklyVolume, preferences.units)}` : "Weekly volume unavailable"}><span className={styles.metricIcon}><BarChart3 size={17}/></span><strong>{dataReady ? volumeLabel : "—"}<small>{weightUnit(preferences.units)}</small></strong><span>Volume</span></Link>
        <Link href="/progress" className={styles.metric} aria-label={dataReady ? `${weeklyRecords} personal records this week` : "Weekly personal records unavailable"}><span className={`${styles.metricIcon} ${styles.gold}`}><Award size={17}/></span><strong>{dataReady ? weeklyRecords : "—"}</strong><span>Records</span></Link>
      </div>
    </section>
    <div className={styles.middle}>{!error && <TodayOverview workouts={history} active={Boolean(active)} ready={dataReady}/>}<QuickStart active={active} lastCompleted={history[0] ?? null} ready={dataReady}/></div>
    <section className={styles.recent} aria-labelledby="recent-training-title">
      <div className={styles.sectionHeading}><div><span>YOUR TRAINING LOG</span><h2 id="recent-training-title">Recent sessions</h2></div><Link href="/history">View all <ArrowRight size={15}/></Link></div>
      {!ready ? <div className={styles.loading} role="status"><span/><span/><span/><p>Loading your training log…</p></div> : error ? <p className={styles.emptyDescription}>Your saved sessions will appear here when your training log loads.</p> : history.length === 0 ? <div className={styles.empty}><span className={styles.emptyIcon}><History size={25}/></span><h3>A fresh start.</h3><p>Your completed workouts will appear here. Already have a training log?</p><Link href="/profile/data"><Upload size={16}/> Import from Hevy or CSV <ArrowRight size={15}/></Link></div> : <div className={styles.feed}>{history.slice(0, 3).map(workout => <WorkoutFeedCard key={workout.id} workout={workout} athlete={athlete} records={recordsByWorkout.get(workout.id) ?? 0}/>)}</div>}
    </section>
    <p className={styles.footerNote}>Built for the work. One session at a time.</p>
  </main>;
}

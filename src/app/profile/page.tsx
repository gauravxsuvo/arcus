"use client";

import { GoalSummary } from "@/components/shared/goal-summary";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Activity, ArrowRight, Award, BarChart3, CalendarDays, Check, Clock3, Cloud, CloudOff, Database, Dumbbell, LogOut, Pencil, Scale, Settings2 } from "lucide-react";
import { findPersonalRecords } from "@/features/analytics/engine";
import { getLocalSession, logoutLocalUser } from "@/features/local-data/repository";
import { calculateWorkoutTotals, type WorkoutRecord } from "@/features/workouts/model";
import { getCompletedWorkouts } from "@/features/workouts/repository";
import { AccountAccess } from "@/components/shared/account-access";
import { useProfile } from "@/components/shared/user-profile-provider";
import { formatWeight,toDisplayWeight,weightUnit } from "@/features/training/logic";

type Profile = { display_name: string | null; experience: string | null; goals: string[]; height_cm: number | null; bio?: string | null; avatarUrl?: string | null; username: string };
type WeekProgress = { label: string; hours: number; volume: number; sessions: number; start: number };
type ChartMetric = "duration" | "volume" | "sessions";

function getWeeklyProgress(workouts: WorkoutRecord[], count: number, weekStart:"monday"|"sunday"): WeekProgress[] {
  const now = new Date();
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  const offset=weekStart==="monday"?6:0;
  monday.setDate(monday.getDate() - ((monday.getDay() + offset) % 7) - (count - 1) * 7);
  const weeks = Array.from({ length: count }, (_, index) => {
    const start = new Date(monday);
    start.setDate(monday.getDate() + index * 7);
    return { start: start.getTime(), label: new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(start), hours: 0, volume: 0, sessions: 0 };
  });
  for (const workout of workouts) {
    if (!workout.completedAt) continue;
    const completedAt = new Date(workout.completedAt);
    const weekStart = new Date(completedAt);
    weekStart.setHours(0, 0, 0, 0);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + offset) % 7));
    const week = weeks.find((item) => item.start === weekStart.getTime());
    const seconds = (Date.parse(workout.completedAt) - Date.parse(workout.startedAt)) / 1000;
    if (week) {
      week.sessions += 1;
      if (seconds > 0 && seconds < 36 * 3600) week.hours += seconds / 3600;
      week.volume += calculateWorkoutTotals(workout).volume;
    }
  }
  return weeks;
}

function formatDuration(seconds: number) {
  const minutes = Math.max(0, Math.round(seconds / 60));
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
}

export default function ProfilePage() {
  const {preferences}=useProfile();const units=preferences.units;
  const formatVolume=(value:number)=>formatWeight(value,units,0);
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutRecord[]>([]);
  const [range, setRange] = useState<12 | 26>(12);
  const [chartMetric, setChartMetric] = useState<ChartMetric>("volume");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [saveNotice, setSaveNotice] = useState<{ text: string; local: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const query = new URLSearchParams(window.location.search);
    const saved = query.get("saved");
    if (saved === "account") setSaveNotice({ text: "Profile and photo saved to your account. Age and sex stay on this device.", local: false });
    else if (saved === "device") setSaveNotice({ text: query.get("sync") === "unavailable" ? "Saved on this device. Your changes are queued for account sync." : "Saved on this device. Sign in to the live server to sync across devices.", local: true });
    void Promise.all([getLocalSession(), getCompletedWorkouts()]).then(([user, sessions]) => {
      if (cancelled) return;
      if (user) setProfile({ display_name: user.name, username: user.username, ...user.profile });
      setWorkouts(sessions);
      setReady(true);
    }).catch((reason: unknown) => {
      if (!cancelled) { setError(reason instanceof Error ? reason.message : "Could not load your training profile."); setReady(true); }
    });
    return () => { cancelled = true; };
  }, []);

  const weeks = useMemo(() => getWeeklyProgress(workouts, range,preferences.weekStart), [workouts, range,preferences.weekStart]);
  const thisWeek = weeks.at(-1) ?? { hours: 0, volume: 0, sessions: 0, label: "", start: 0 };
  const totalVolume = toDisplayWeight(workouts.reduce((sum, workout) => sum + calculateWorkoutTotals(workout).volume, 0),units);
  const totalVolumeLabel = totalVolume >= 1000 ? `${(totalVolume / 1000).toFixed(totalVolume >= 10000 ? 0 : 1)}k` : Math.round(totalVolume).toLocaleString();
  const recordsByWorkout = useMemo(() => {
    const counts = new Map<string, number>();
    for (const record of findPersonalRecords(workouts)) counts.set(record.workoutId, (counts.get(record.workoutId) ?? 0) + 1);
    return counts;
  }, [workouts]);
  const chartValues = weeks.map((week) => chartMetric === "duration" ? week.hours : chartMetric === "volume" ? toDisplayWeight(week.volume,units) : week.sessions);
  const hasChartData = chartValues.some((value) => value > 0);
  const maxValue = Math.max(1, ...chartValues);
  const athlete = profile?.display_name || profile?.username || "Athlete";
  const chartValueLabel = chartMetric === "duration" ? formatDuration(thisWeek.hours * 3600) : chartMetric === "volume" ? formatVolume(thisWeek.volume) : `${thisWeek.sessions}`;
  const chartCaption = chartMetric === "duration" ? "Training time" : chartMetric === "volume" ? "Weight lifted" : "Completed workouts";
  const chartUnit = chartMetric === "duration" ? "hours per week" : chartMetric === "volume" ? `${weightUnit(units)} per week` : "sessions per week";

  function formatChartValue(value: number) {
    if (chartMetric === "duration") return `${value.toFixed(value >= 10 ? 0 : 1)}h`;
    if (chartMetric === "volume") return value >= 1000 ? `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}k` : `${Math.round(value)}`;
    return `${Math.round(value)}`;
  }

  async function signOut() {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      await logoutLocalUser();
      router.push("/"); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not sign out."); }
  }

  return <main className="social-shell profile-social-shell">
    <header className="profile-social-head"><div><p className="social-kicker"><span className="social-live-dot"/> ATHLETE PROFILE</p><h1>{profile ? `@${profile.username}` : athlete}</h1></div><div className="social-head-actions"><Link className="social-icon-button" href="/profile/edit" aria-label="Customize profile"><Pencil size={19}/></Link><Link className="social-icon-button" href="/profile/data" aria-label="Data and settings"><Settings2 size={20}/></Link></div></header>

    {saveNotice && <p className="profile-save-notice" role="status"><span>{saveNotice.local ? <CloudOff size={16}/> : <Cloud size={16}/>}</span>{saveNotice.text}<button type="button" aria-label="Dismiss saved message" onClick={() => setSaveNotice(null)}><Check size={16}/></button></p>}
    <AccountAccess /><GoalSummary workouts={workouts}/>
    {!ready ? <div className="social-empty">Loading your profile…</div> : <>
      <section className="profile-social-summary">
        <div className="profile-social-avatar" aria-hidden="true">{profile?.avatarUrl ? <Image src={profile.avatarUrl} alt="" width={78} height={78} sizes="78px" unoptimized/> : athlete.charAt(0).toLocaleUpperCase()}</div>
        <div className="profile-social-info"><h2>{athlete}</h2><p>{profile?.bio || (profile?.goals?.length ? profile.goals.join(" · ") : "Keep showing up, one session at a time.")}</p>{profile?.experience && <span>{profile.experience} lifter</span>}</div>
        <div className="profile-social-counts"><div><strong>{workouts.length}</strong><span>Workouts</span></div><div><strong>{thisWeek.hours ? formatDuration(thisWeek.hours * 3600) : thisWeek.sessions}</strong><span>{thisWeek.hours ? "This week" : "Sessions this week"}</span></div><div><strong>{totalVolumeLabel}</strong><span>{weightUnit(units)} volume</span></div></div>
      </section>

      <section className="profile-chart-card">
        <div className="profile-chart-heading"><div><p className="social-kicker">YOUR PROGRESS</p><h2>{chartValueLabel} <span>this week</span></h2></div><label className="range-picker"><span className="visually-hidden">Chart range</span><select aria-label="Chart range" value={range} onChange={(event) => setRange(Number(event.target.value) as 12 | 26)}><option value={12}>Last 3 months</option><option value={26}>Last 6 months</option></select></label></div>
        <div className="profile-chart-controls" role="group" aria-label="Choose progress chart">
          <button type="button" aria-pressed={chartMetric === "volume"} className={chartMetric === "volume" ? "profile-chart-metric is-selected" : "profile-chart-metric"} onClick={() => setChartMetric("volume")}><Scale size={14}/> Volume</button>
          <button type="button" aria-pressed={chartMetric === "duration"} className={chartMetric === "duration" ? "profile-chart-metric is-selected" : "profile-chart-metric"} onClick={() => setChartMetric("duration")}><Clock3 size={14}/> Time</button>
          <button type="button" aria-pressed={chartMetric === "sessions"} className={chartMetric === "sessions" ? "profile-chart-metric is-selected" : "profile-chart-metric"} onClick={() => setChartMetric("sessions")}><Dumbbell size={14}/> Sessions</button>
        </div>
        {hasChartData ? <div className="duration-chart" role="img" aria-label={`${range === 12 ? "12 weeks" : "26 weeks"} of ${chartMetric === "duration" ? "workout duration" : chartMetric === "volume" ? "training volume" : "completed workouts"}`}>
          <div className="chart-grid-labels"><span>{formatChartValue(maxValue)}</span><span>{formatChartValue(maxValue / 2)}</span><span>0</span></div>
          <div className="duration-chart-bars">{weeks.map((week, index) => { const value = chartValues[index]; const showLabel = (range === 12 ? index % 2 === 0 : index % 4 === 0) || index === weeks.length - 1; return <div className="duration-chart-column" key={week.start} title={`${week.label}: ${chartMetric === "duration" ? `${week.hours.toFixed(1)} hours` : chartMetric === "volume" ? formatVolume(week.volume) : `${week.sessions} workouts`}`}><span className="duration-chart-bar" style={{ height: `${Math.max(value ? 5 : 0, (value / maxValue) * 100)}%` }}/>{showLabel && <small>{week.label}</small>}</div>; })}</div>
        </div> : <div className="duration-chart-empty" role="status"><span><BarChart3 size={18}/></span><strong>No progress yet</strong><small>{chartMetric === "volume" ? "Log a weighted set to start your volume trend." : chartMetric === "duration" ? "Finish a workout to see your training time." : "Complete a workout to start your session trend."}</small></div>}
        {hasChartData && <div className="chart-legend"><span><i/> {chartCaption}</span><span>{chartUnit}</span></div>}
      </section>

      <section className="profile-shortcuts"><h2>Dashboard</h2><div className="profile-shortcut-grid"><Link href="/progress"><BarChart3 size={21}/><span>Statistics</span><ArrowRight size={15}/></Link><Link href="/exercises"><Dumbbell size={21}/><span>Exercises</span><ArrowRight size={15}/></Link><Link href="/programs"><CalendarDays size={21}/><span>Plans</span><ArrowRight size={15}/></Link><Link href="/profile/data"><Database size={21}/><span>Data & import</span><ArrowRight size={15}/></Link></div></section>

      <section className="profile-workouts"><div className="activity-heading"><div><p className="social-kicker">YOUR TRAINING LOG</p><h2>Workouts</h2></div><Link href="/history">See all <ArrowRight size={15}/></Link></div>{workouts.length === 0 ? <div className="social-empty"><span className="social-empty-icon"><Activity size={21}/></span><p>Completed workouts will appear here.</p><Link href="/workout">Start a workout <ArrowRight size={15}/></Link></div> : workouts.slice(0, 5).map((workout) => <Link className="profile-workout-row" href={`/history/${workout.id}`} key={workout.id}><span className="profile-workout-icon"><Dumbbell size={18}/></span><span><strong>{workout.name?.toLocaleLowerCase() === "imported workout" ? "Workout" : workout.name || "Workout"}</strong><small>{new Date(workout.completedAt ?? workout.startedAt).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {workout.exercises.length} exercises</small></span><span className="profile-row-volume">{formatWeight(calculateWorkoutTotals(workout).volume,units,0)}{recordsByWorkout.get(workout.id) ? <small><Award size={13} fill="currentColor"/>{recordsByWorkout.get(workout.id)}</small> : null}</span><ArrowRight size={15}/></Link>)}
      </section>
      {profile && <section className="profile-account-actions"><Link href="/profile/edit">Customize profile <ArrowRight size={15}/></Link><button onClick={() => void signOut()}><LogOut size={15}/> Sign out</button></section>}
    </>}
    {error && <p role="alert" className="auth-error">{error}</p>}
  </main>;
}

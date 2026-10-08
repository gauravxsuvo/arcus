"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ShareCard } from "@/components/shared/share-card-generator";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, CheckCircle2, Clock3, Copy, Dumbbell, Flame, Plus, Sparkles, Trash2, X, CalendarDays, Upload, ShieldCheck, ChevronDown } from "lucide-react";
import { exerciseCatalog, type Exercise } from "@/features/exercises/catalog";
import { calculateWorkoutTotals, createWorkout, type LoggedSet, type WorkoutExercise, type WorkoutRecord } from "@/features/workouts/model";
import { generateWarmupSets } from "@/features/workouts/warmup";
import { deleteWorkout, getActiveWorkout, getCompletedWorkouts, getWorkoutById, saveWorkout } from "@/features/workouts/repository";
import { syncCompletedWorkout } from "@/features/workouts/sync";
import { listCustomExercises, listPrograms, markExerciseUsed, getExercisePreferences, getLocalSession, listExerciseSettings } from "@/features/local-data/repository";

import { ExercisePicker } from "@/components/workout/exercise-picker";
import { GroupExercises, GroupedExercises } from "@/components/workout/group-exercises";
import { useProfile } from "@/components/shared/user-profile-provider";
import { useWorkout } from "@/components/shared/workout-provider";
import type { ExerciseSettings } from "@/features/profile/model";
import { groupRoundComplete, nextLoad, formatWeight, fromDisplayWeight, toDisplayWeight, weightUnit, detectRecords } from "@/features/training/logic";
import { programSchedule } from "@/features/programs/schedule";
import styles from "./workout.module.css";
const PlateCalculator=dynamic(()=>import("@/components/shared/plate-calculator"),{ssr:false});

function newSet(index: number): LoggedSet {
  return { id: crypto.randomUUID(), index, weight: null, reps: null, rpe: null, completed: false, completedAt: null, setType: "working" };
}

function formatTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}` : `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function comparableVolume(workout: WorkoutRecord, exerciseIds: Set<string>) {
  return workout.exercises.filter((exercise) => exerciseIds.has(exercise.exerciseId)).flatMap((exercise) => exercise.sets)
    .filter((set) => set.completed).reduce((sum, set) => sum + (set.weight ?? 0) * (set.reps ?? 0), 0);
}

function adjustNumber(value: number | null, delta: number, minimum = 0) {
  return Math.max(minimum, (value ?? 0) + delta);
}

export default function WorkoutPage() {
  const {workout,setWorkout}=useWorkout();
  const {preferences:profilePreferences}=useProfile();
  const units=profilePreferences.units;
  const [exerciseSettings,setExerciseSettings]=useState<ExerciseSettings[]>([]);
  const audioRef=useRef<HTMLAudioElement|null>(null);
  const [livePr,setLivePr]=useState("");
  const [completedWorkout, setCompletedWorkout] = useState<WorkoutRecord | null>(null);
  const [history, setHistory] = useState<WorkoutRecord[]>([]);
  const [catalog, setCatalog] = useState<Exercise[]>(exerciseCatalog);
  const [preferences, setPreferences] = useState<{ id: string; favorite: boolean; usedAt: string | null; useCount: number }[]>([]);
  const [ready, setReady] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const [elapsed, setElapsed] = useState(0);
  const [restEnd, setRestEnd] = useState<number | null>(null);
  const [restLeft, setRestLeft] = useState(0);
  const [message, setMessage] = useState("");
  const [saveState, setSaveState] = useState<"saved" | "saving" | "error">("saved");
  const [busy, setBusy] = useState<"starting" | "finishing" | "deleting" | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const saveVersionRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getActiveWorkout(), getCompletedWorkouts(), listPrograms(), listCustomExercises(), getExercisePreferences(),getLocalSession(),listExerciseSettings()]).then(async ([saved, completed, programs, customExercises, exercisePreferences,user,settings]) => {
      if (!cancelled) {
        setHistory(completed);
        const availableExercises = [...exerciseCatalog, ...customExercises];
        setCatalog(availableExercises);
        setPreferences(exercisePreferences);
        setExerciseSettings(settings);
        const defaultRest=user?.profile.preferences?.defaultRestTimer??90;
        const params = new URLSearchParams(window.location.search);
        const requested = availableExercises.find((exercise) => exercise.id === params.get("add"));
        let current = saved;
        if(params.get("repeat")){
          if(saved)setMessage("Resume or finish your active workout before repeating another session.");
          else{const source=await getWorkoutById(params.get("repeat")!);if(source){current={...createWorkout(),name:source.name,exercises:source.exercises.map(e=>({...e,id:crypto.randomUUID(),sets:e.sets.map((s,index)=>({...s,id:crypto.randomUUID(),index,completed:false,completedAt:null,rpe:null,rir:null}))}))};await saveWorkout(current);}}
          window.history.replaceState(null,"","/workout");
        }
        if (requested) {
          current ??= createWorkout();
          if (!current.exercises.some((exercise) => exercise.exerciseId === requested.id)) {
            const item: WorkoutExercise = {
              id: crypto.randomUUID(), exerciseId: requested.id, name: requested.name, muscle: requested.muscle,
              equipment: requested.equipment, restSeconds: settings.find(s=>s.id===requested.id)?.restSeconds??defaultRest, sets: [newSet(0), newSet(1), newSet(2)],
            };
            current = { ...current, exercises: [...current.exercises, item] };
            await saveWorkout(current);
            void markExerciseUsed(requested.id);
          }
        }
        const program = programs.find((item) => item.id === params.get("program"));
        const programDay = program?.days.find((item) => item.id === params.get("day"));
        if (program && programDay && !saved) {
          current ??= createWorkout();
          if (!saved) current = { ...current, name: `${program.name} · ${programDay.name}` };
          const enrollment=user?.profile.activeProgram?.programId===program.id?user.profile.activeProgram:null;
          const schedule=enrollment?programSchedule(program,enrollment):null;
          const planned = programDay.exercises.map((exercise) => {
            const setting=settings.find(s=>s.id===exercise.exerciseId);
            const previous=completed.flatMap(w=>w.exercises.filter(e=>e.exerciseId===exercise.exerciseId));
            const rule=setting?.progression??{type:exercise.progressionMethod==="manual"?"none" as const:"double" as const,increment:2.5,repMin:exercise.repMin,repMax:exercise.repMax,deloadPercent:10,deloadAfterFails:0};
            const suggestion=nextLoad(previous,rule);
            const factor=schedule?.deload?1-(program.deloadReductionPercent??40)/100:1;
            const targets=exercise.setTargets;
            const explicitDeload=!!targets&&targets.length===3&&new Set(targets.map(s=>s.percentage)).size>1&&targets.every(s=>(s.percentage??100)<=60);
            const count=schedule?.deload&&!explicitDeload?Math.max(1,Math.ceil(exercise.sets*factor)):exercise.sets;
            const trainingMax=enrollment?.trainingMaxes?.[exercise.exerciseId];
            const blockFactor=1+((schedule?.block??1)-1)*(program.blockIncreasePercent??2)/100;
            return {
            id: crypto.randomUUID(), exerciseId: exercise.exerciseId, name: exercise.name, muscle: exercise.muscle,
            equipment: exercise.equipment, targetRepMin: exercise.repMin,
            targetRepMax: exercise.repMax, targetProgressionMethod: exercise.progressionMethod,
            targetProgressionValue: exercise.progressionValue,targetRpe:exercise.targetRpe,suggestedChange:suggestion.change, restSeconds:setting?.restSeconds??exercise.restSeconds,
            sets: Array.from({ length: count }, (_, index) => ({...newSet(index),reps:targets?.[index]?.reps??exercise.repMin,weight:targets?.[index]?.percentage?trainingMax?Math.round(trainingMax*blockFactor*targets[index].percentage!/100*(explicitDeload?1:factor)*100)/100:null:suggestion.load===null?null:Math.round(suggestion.load*factor*100)/100})),
          };});
          current = { ...current, programId:program.id,programDay:programDay.id, exercises: [...current.exercises, ...planned] };
          await saveWorkout(current);
        }
        if (requested) window.history.replaceState(null, "", "/workout");
        if (programDay) window.history.replaceState(null, "", "/workout");
        if(current&&!saved&&!programDay&&!params.get("repeat")){current={...current,exercises:current.exercises.map(item=>{const rule=settings.find(s=>s.id===item.exerciseId)?.progression;const previous=completed.flatMap(w=>w.exercises.filter(e=>e.exerciseId===item.exerciseId));const suggestion=rule?nextLoad(previous,rule):null;return suggestion?.load!==null&&suggestion?{...item,suggestedChange:suggestion.change,sets:item.sets.map(s=>({...s,weight:suggestion.load,reps:suggestion.reps}))}:item;})};await saveWorkout(current);}
        setWorkout(current);
        if (current) {
          setElapsed(Math.floor((Date.now() - Date.parse(current.startedAt)) / 1000));
          if (current.restUntil && Date.parse(current.restUntil) > Date.now()) {
            setRestEnd(Date.parse(current.restUntil));
            setRestLeft(Math.ceil((Date.parse(current.restUntil) - Date.now()) / 1000));
          }
        }
        setReady(true);
      }
    }).catch(() => { if (!cancelled) { setMessage("Local storage is unavailable in this browser."); setReady(true); } });
    return () => { cancelled = true; };
  }, [setWorkout]);

  useEffect(()=>{audioRef.current=new Audio("/sounds/timer-done.wav");audioRef.current.preload="auto";return()=>{audioRef.current?.pause();};},[]);

  useEffect(() => {
    if (!workout) return;
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - Date.parse(workout.startedAt)) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, [workout]);

  useEffect(() => {
    if (!restEnd) return;
    const timer = window.setInterval(() => {
      const left = Math.max(0, Math.ceil((restEnd - Date.now()) / 1000));
      setRestLeft(left);
      if (left === 0) { setRestEnd(null); setMessage("Rest finished. Ready for the next round."); void audioRef.current?.play().catch(()=>undefined); navigator.vibrate?.(200); }
    }, 250);
    return () => window.clearInterval(timer);
  }, [restEnd]);

  const persist = useCallback((updated: WorkoutRecord) => {
    setWorkout(updated);
    const version = ++saveVersionRef.current;
    setSaveState("saving");
    const save = saveQueueRef.current.catch(() => undefined).then(() => saveWorkout(updated));
    saveQueueRef.current = save;
    void save.then(() => {
      if (version === saveVersionRef.current) setSaveState("saved");
    }).catch(() => {
      if (version === saveVersionRef.current) {
        setSaveState("error");
        setMessage("Your latest changes could not save. Keep this tab open and try saving again.");
      }
    });
  }, [setWorkout]);

  const beginWorkout = async () => {
    if (busy) return;
    setBusy("starting");
    const active = createWorkout();
    try {
      await saveWorkout(active);
      setWorkout(active);
      setCompletedWorkout(null);
      setSaveState("saved");
      setElapsed(0);
      setMessage("");
    } catch {
      setMessage("Could not start: browser storage is unavailable.");
    } finally {
      setBusy(null);
    }
  };

  const addExercise = (exercise: Exercise) => {
    if (!workout) return;
    const previous = history.flatMap((session) => session.exercises).find((item) => item.exerciseId === exercise.id);
    const previousSets = previous?.sets.filter((set) => set.completed) ?? [];
    const setting=exerciseSettings.find(s=>s.id===exercise.id);
    const suggestion=setting?.progression?nextLoad(history.flatMap(w=>w.exercises.filter(e=>e.exerciseId===exercise.id)),setting.progression):null;
    const item: WorkoutExercise = {
      id: crypto.randomUUID(), exerciseId: exercise.id, name: exercise.name, muscle: exercise.muscle,
      equipment: exercise.equipment, restSeconds: setting?.restSeconds??profilePreferences.defaultRestTimer, suggestedChange:suggestion?.change, sets: [0, 1, 2].map((index) => ({ ...newSet(index), weight: suggestion?.load??previousSets[index]?.weight ?? null, reps: suggestion?.reps??previousSets[index]?.reps ?? null })),
    };
    persist({ ...workout, exercises: [...workout.exercises, item] });
    void markExerciseUsed(exercise.id);
    setPreferences(current => {
      const previous = current.find(item => item.id === exercise.id);
      return [...current.filter(item => item.id !== exercise.id), { id: exercise.id, favorite: previous?.favorite ?? false, usedAt: new Date().toISOString(), useCount: (previous?.useCount ?? 0) + 1 }];
    });
    setPickerOpen(false);

  };

  const updateSet = (exerciseId: string, setId: string, update: Partial<LoggedSet>) => {
    if (!workout) return;
    const exercises = workout.exercises.map((exercise) => exercise.id !== exerciseId ? exercise : {
      ...exercise, sets: exercise.sets.map((set) => set.id === setId ? { ...set, ...update } : set),
    });
    persist({ ...workout, exercises });
  };

  const adjustSetValue = (exerciseId: string, setId: string, field: "weight" | "reps", delta: number) => {
    const exercise = workout?.exercises.find((item) => item.id === exerciseId);
    const set = exercise?.sets.find((item) => item.id === setId);
    if (!set) return;
    const next = adjustNumber(set[field], field==="weight"?fromDisplayWeight(delta,units):delta, 0);
    updateSet(exerciseId, setId, { [field]: field === "reps" ? Math.round(next) : Number(next.toFixed(2)) });
  };

  const addSet = (exerciseId: string) => {
    if (!workout) return;
    const exercises = workout.exercises.map((exercise) => exercise.id !== exerciseId ? exercise : {
      ...exercise, sets: [...exercise.sets, newSet(exercise.sets.length)],
    });
    persist({ ...workout, exercises });
  };

  const addWarmupSets = (exerciseId: string) => {
    if (!workout) return;
    const exercises = workout.exercises.map((exercise) => {
      if (exercise.id !== exerciseId) return exercise;
      const workingWeight = exercise.sets.find((set) => set.completed && set.weight && set.setType !== "warmup")?.weight ?? exercise.sets.find((set) => set.weight)?.weight ?? 0;
      const warmups = generateWarmupSets(workingWeight);
      if (!warmups.length) { setMessage("Enter a working weight first to generate warm-up sets."); return exercise; }
      const sets = [...warmups, ...exercise.sets.map((set) => ({ ...set, index: set.index + warmups.length }))];
      return { ...exercise, sets };
    });
    persist({ ...workout, exercises });
  };

  const removeExercise = (exerciseId: string) => {
    if (!workout) return;
    persist({ ...workout, exercises: workout.exercises.filter((exercise) => exercise.id !== exerciseId) });
  };

  const moveExercise = (exerciseId: string, direction: -1 | 1) => {
    if (!workout) return;
    const current = workout.exercises.findIndex((item) => item.id === exerciseId);
    const target = current + direction;
    if (current < 0 || target < 0 || target >= workout.exercises.length) return;
    const exercises = [...workout.exercises];
    [exercises[current], exercises[target]] = [exercises[target], exercises[current]];
    persist({ ...workout, exercises });
  };

  const removeSet = (exerciseId: string, setId: string) => {
    if (!workout) return;
    const exercises = workout.exercises.map((item) => {
      if (item.id !== exerciseId || item.sets.length < 2) return item;
      return { ...item, sets: item.sets.filter((set) => set.id !== setId).map((set, index) => ({ ...set, index })) };
    });
    persist({ ...workout, exercises });
  };

  const moveSet = (exerciseId: string, setId: string, direction: -1 | 1) => {
    if (!workout) return;
    const exercises = workout.exercises.map((item) => {
      if (item.id !== exerciseId) return item;
      const current = item.sets.findIndex((set) => set.id === setId);
      const target = current + direction;
      if (current < 0 || target < 0 || target >= item.sets.length) return item;
      const sets = [...item.sets];
      [sets[current], sets[target]] = [sets[target], sets[current]];
      return { ...item, sets: sets.map((set, index) => ({ ...set, index })) };
    });
    persist({ ...workout, exercises });
  };

  const duplicateSet = (exerciseId: string, set: LoggedSet) => {
    if (!workout) return;
    const exercises = workout.exercises.map((item) => item.id !== exerciseId ? item : {
      ...item,
      sets: [...item.sets, { ...set, id: crypto.randomUUID(), index: item.sets.length, completed: false, completedAt: null }],
    });
    persist({ ...workout, exercises });
  };

  const completeSet = (exercise: WorkoutExercise, set: LoggedSet) => {
    if (set.completed) {
      const exercises = workout?.exercises.map((item) => item.id !== exercise.id ? item : {
        ...item, sets: item.sets.map((current) => current.id === set.id ? { ...current, completed: false, completedAt: null } : current),
      });
      if (workout && exercises) persist({ ...workout, exercises, restUntil: null });
      setRestEnd(null);
      return;
    }
    if((set.reps??0)<=0||set.weight!==null&&(!Number.isFinite(set.weight)||set.weight<0)){setMessage("Enter reps and a valid load before completing the set.");return;}
    if(audioRef.current){const audio=audioRef.current;audio.volume=0;void audio.play().then(()=>{audio.pause();audio.currentTime=0;audio.volume=1;}).catch(()=>{audio.volume=1;});}
    const timestamp = new Date().toISOString();
    const restEndAt = Date.now() + exercise.restSeconds * 1000;
    const exercises = workout?.exercises.map((item) => item.id !== exercise.id ? item : {
      ...item, sets: item.sets.map((current) => current.id === set.id ? { ...current, completed: true, completedAt: timestamp } : current),
    });
    if(!workout||!exercises)return;
    const shouldRest=groupRoundComplete(exercises,exercise.id,set.id)&&exercise.restSeconds>0;
    const draft={...workout,exercises,completedAt:timestamp,status:"completed" as const};
    const records=detectRecords([...history,draft]).filter(r=>r.workoutId===workout.id&&r.exerciseId===exercise.exerciseId);
    if(records.length)setLivePr(`New ${records[0].type==="volume"?"session volume":records[0].type==="1rm"?"single-rep":"estimated 1RM"} PR · ${exercise.name} · ${formatWeight(records[0].value,units)}`);
    persist({ ...workout, exercises, restUntil: shouldRest?new Date(restEndAt).toISOString():null });
    setRestEnd(shouldRest?restEndAt:null);
    setRestLeft(shouldRest?exercise.restSeconds:0);
  };

  const finishWorkout = async () => {
    if (busy) return;
    if (!workout || !workout.exercises.some((exercise) => exercise.sets.some((set) => set.completed))) {
      setMessage("Log at least one completed set before finishing.");
      return;
    }
    const finished = { ...workout, status: "completed" as const, completedAt: new Date().toISOString(), restUntil: null, syncStatus: "pending" as const };
    setBusy("finishing");
    try {
      await saveQueueRef.current.catch(() => undefined);
      await saveWorkout(finished);
      // Keep the persisted pending revision for background sync. A failed request
      // must never write this snapshot over edits made later in History.
      void syncCompletedWorkout(finished).catch(() => undefined);
      setCompletedWorkout(finished);
      setWorkout(null);
      setRestEnd(null);
      setMessage("");
      setSaveState("saved");
    } catch {
      setSaveState("error");
      setMessage("Could not finish saving. Your active session is still here. Keep this tab open and try again.");
    } finally {
      setBusy(null);
    }
  };

  const cancelWorkout = async () => {
    if (busy || !workout || !window.confirm("Delete this workout and all its sets?")) return;
    setBusy("deleting");
    try {
      await saveQueueRef.current.catch(() => undefined);
      await deleteWorkout(workout.id);
      setWorkout(null);
      setRestEnd(null);
      setMessage("");
    } catch {
      setMessage("Could not delete this session. Your workout is still available.");
    } finally {
      setBusy(null);
    }
  };

  const previousByExercise = useMemo(() => {
    const previous = new Map<string, WorkoutExercise>();
    for (const session of history) {
      for (const item of session.exercises) {
        if (!previous.has(item.exerciseId)) previous.set(item.exerciseId, item);
      }
    }
    return previous;
  }, [history]);
  const totals = workout ? calculateWorkoutTotals(workout) : null;
  const plannedSets = workout?.exercises.reduce((count, exercise) => count + exercise.sets.length, 0) ?? 0;
  const loggedSets = workout?.exercises.reduce((count, exercise) => count + exercise.sets.filter(set => set.completed).length, 0) ?? 0;
  const completionTotals = completedWorkout ? calculateWorkoutTotals(completedWorkout) : null;
  const completionRecords = completedWorkout ? detectRecords([...history, completedWorkout]).filter((record) => record.workoutId === completedWorkout.id) : [];
  const completedRpes = completedWorkout?.exercises.flatMap((exercise) => exercise.sets.filter((set) => set.completed && set.rpe !== null).map((set) => set.rpe as number)) ?? [];
  const completionMuscles = [...new Set(completedWorkout?.exercises.map((exercise) => exercise.muscle) ?? [])];
  const comparableSession = completedWorkout ? history.find((session) => (session.completedAt ?? "") < (completedWorkout.completedAt ?? "") && session.exercises.some((exercise) => completedWorkout.exercises.some((current) => current.exerciseId === exercise.exerciseId))) : null;
  const comparableExerciseIds = new Set(comparableSession?.exercises.filter((exercise) => completedWorkout?.exercises.some((current) => current.exerciseId === exercise.exerciseId)).map((exercise) => exercise.exerciseId) ?? []);
  const priorVolume = comparableSession ? comparableVolume(comparableSession, comparableExerciseIds) : 0;
  const currentComparableVolume = completedWorkout ? comparableVolume(completedWorkout, comparableExerciseIds) : 0;
  const comparableChange = priorVolume ? Math.round((currentComparableVolume - priorVolume) / priorVolume * 100) : null;

  if (!ready) return <main className={`workout-shell ${styles.shell}`}><div className={styles.loading} role="status"><Dumbbell size={24}/><span>Getting your workout ready…</span></div></main>;
  if (completedWorkout && completionTotals) return <main className="workout-shell completion-shell"><header className="workout-top"><Link className="brand" href="/dashboard"><span className="brand-mark">A</span><span>ARCUS<span className="brand-period">.</span></span></Link><span className="offline-badge"><span/> SAVED ON THIS DEVICE</span></header><section className={`completion-hero ${completionRecords.length ? "has-pr" : ""}`}><div className="completion-check"><Check size={25}/></div>{completionRecords.length > 0 && <div className="pr-celebration"><Sparkles size={16}/> NEW PR{completionRecords.length > 1 ? "S" : ""}</div>}<p className="eyebrow"><span className="live-dot"/> SESSION COMPLETE</p><h1>{completionRecords.length ? "Stronger today" : "Good work"}<span>.</span></h1><p>{completedWorkout.name} · {new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(new Date(completedWorkout.completedAt ?? completedWorkout.startedAt))}</p></section><ShareCard workout={completedWorkout}/><section className="completion-stats"><article><span>DURATION</span><strong>{formatTime(completionTotals.durationSeconds)}</strong></article><article><span>WORKING SETS</span><strong>{completionTotals.sets}</strong></article><article><span>TOTAL REPS</span><strong>{completionTotals.reps}</strong></article><article><span>VOLUME</span><strong>{toDisplayWeight(completionTotals.volume,units).toLocaleString()} <small>{weightUnit(units)}</small></strong></article></section><div className="analytics-grid completion-grid"><article className="analytics-panel"><div className="panel-heading"><div><p className="eyebrow">PERSONAL RECORDS</p><h2>{completionRecords.length ? `${completionRecords.length} strength ${completionRecords.length === 1 ? "milestone" : "milestones"}` : "Keep building"}</h2></div><CheckCircle2 className="panel-icon" size={18}/></div>{completionRecords.length ? completionRecords.map((record) => <div className="pr-row" key={record.id}><span className="pr-main"><strong>{record.exerciseName}</strong><small>{record.type==="volume"?"Session volume":record.type==="1rm"?"Single-rep best":"Estimated 1RM"}</small></span><span className="pr-value">{formatWeight(record.value,units)}</span></div>) : <p className="method-note">New single-rep, estimated 1RM and session-volume records will appear here.</p>}{completedRpes.length > 0 && <div className="completion-rpe"><span>AVERAGE RPE</span><strong>{(completedRpes.reduce((sum, value) => sum + value, 0) / completedRpes.length).toFixed(1)} / 10</strong></div>}</article><article className="analytics-panel"><div className="panel-heading"><div><p className="eyebrow">SESSION FOCUS</p><h2>{completionMuscles.length} muscle {completionMuscles.length === 1 ? "group" : "groups"}</h2></div><Dumbbell className="panel-icon" size={18}/></div><div className="focus-pills">{completionMuscles.map((muscle) => <span key={muscle}>{muscle}</span>)}</div>{comparableSession && <div className="comparison-card"><span>VS PREVIOUS COMPARABLE SESSION</span><strong className={comparableChange !== null && comparableChange > 0 ? "comparison-positive" : ""}>{comparableChange === null ? "Comparison unavailable" : `${comparableChange > 0 ? "+" : ""}${comparableChange}% volume`}</strong><small>{comparableSession.name}</small></div>}<p className="method-note">Saved locally. ARCUS will sync this session when a connection and account are available.</p></article></div><footer className="completion-actions"><Link className="outline-button" href="/history">View history</Link><button className="action-button" onClick={() => void beginWorkout()}>Start another <ArrowRight size={15}/></button></footer></main>;
  if (!workout) return (
    <main className={`workout-shell ${styles.shell}`}>
      <header className={styles.topbar}><Link className={styles.back} href="/dashboard"><ArrowLeft size={18} /> Home</Link><span className={styles.saveStatus}><ShieldCheck size={15}/> Works offline</span></header>
      <div className={styles.pageTitle}><p className="eyebrow"><span className="live-dot" /> YOUR TRAINING SPACE</p><h1>Workout</h1><p>A little work today. A stronger you tomorrow.</p></div>
      <section className={styles.startCard}>
        <span className={styles.startIcon}><Dumbbell size={28}/></span>
        <p className={styles.kicker}>READY WHEN YOU ARE</p>
        <h2>Let’s get moving.</h2>
        <p>Start a session, choose your exercises, and track each set as you go.</p>
        <button className={styles.primary} disabled={busy !== null} onClick={() => void beginWorkout()}><Plus size={20}/>{busy === "starting" ? "Starting…" : "Start workout"}</button>
        <span className={styles.reassurance}><ShieldCheck size={15}/> Your progress saves automatically on this device.</span>
      </section>
      {message && <p className={styles.notice} role="status">{message}</p>}
      <div className={styles.startAlternatives}>
        <Link href="/programs"><CalendarDays size={22}/><span><strong>Follow a program</strong><small>Choose a routine for today</small></span><ArrowRight size={18}/></Link>
        <Link href="/profile/data"><Upload size={22}/><span><strong>Import workouts</strong><small>Bring your previous training with you</small></span><ArrowRight size={18}/></Link>
      </div>
      <Link className={styles.catalogLink} href="/exercises">Explore the exercise library <ArrowRight size={16}/></Link>
    </main>
  );

  return (
    <main className={`workout-shell ${styles.shell}`}>
      <header className={`${styles.topbar} ${styles.stickyTop}`}><Link className={styles.back} href="/dashboard" aria-label="Go Home; your session stays saved"><ArrowLeft size={18} /> Home</Link><span className={`${styles.saveStatus} ${saveState === "error" ? styles.saveError : ""}`} role="status"><ShieldCheck size={14}/>{saveState === "error" ? "Save needed" : saveState === "saving" ? "Saving…" : "Saved on device"}</span><button className={styles.finish} aria-label="Finish workout" disabled={busy !== null} onClick={() => void finishWorkout()}>{busy === "finishing" ? "Saving…" : "Finish"}<Check size={17}/></button></header>
      <fieldset className={styles.editable} disabled={busy === "finishing" || busy === "deleting"}>
      <section className="workout-heading">
        <div><p className="eyebrow"><span className="live-dot" /> IN PROGRESS</p><input aria-label="Workout name" className="workout-name" value={workout.name} onChange={(event) => persist({ ...workout, name: event.target.value })} /><span className={styles.nameHint}>Tap the name to rename your session</span></div>
        <div className="elapsed-chip"><Clock3 size={16} /><span>{formatTime(elapsed)}</span></div>
      </section>
      <section className="session-summary" aria-label="Session totals"><div><strong>{workout.exercises.length}</strong><span>Exercises</span></div><div><strong>{loggedSets}<small> / {plannedSets}</small></strong><span>Sets completed</span></div><div><strong>{formatWeight(totals?.volume??0,units)}</strong><span>Total volume</span></div></section>
      {plannedSets > 0 && <div className={styles.progressTrack} role="progressbar" aria-label="Completed sets" aria-valuemin={0} aria-valuemax={plannedSets} aria-valuenow={loggedSets}><span style={{width: `${loggedSets / plannedSets * 100}%`}}/></div>}
      {message && <div className={styles.notice} role="status"><p>{message}</p>{saveState === "error" && <button className={styles.retry} onClick={() => { setMessage(""); persist(workout); }}>Try saving again</button>}<button className={styles.dismiss} aria-label="Dismiss message" onClick={() => setMessage("")}><X size={16}/></button></div>}

      {restEnd && <aside className={styles.restTimer} aria-label="Rest timer"><div className={styles.restTime}><Clock3 size={19}/><div><span>Rest timer</span><strong>{formatTime(restLeft)}</strong></div></div><label className={styles.restEdit}>Seconds<input aria-label="Edit remaining rest time" type="number" min="0" max="1800" value={restLeft} onChange={event=>{const next=Math.max(0,Math.min(1800,Number(event.target.value)));setRestEnd(Date.now()+next*1000);setRestLeft(next);persist({...workout,restUntil:new Date(Date.now()+next*1000).toISOString()});}}/></label><div className={styles.restControls}><button onClick={() => { const next = Math.max(0, restLeft - 15); setRestEnd(Date.now() + next * 1000); setRestLeft(next); persist({ ...workout, restUntil: new Date(Date.now() + next * 1000).toISOString() }); }} aria-label="Subtract 15 seconds">−15</button><button onClick={() => { const next = Math.min(1800, restLeft + 15); setRestEnd(Date.now() + next * 1000); setRestLeft(next); persist({ ...workout, restUntil: new Date(Date.now() + next * 1000).toISOString() }); }} aria-label="Add 15 seconds">+15</button><button onClick={() => { setRestEnd(null); persist({ ...workout, restUntil: null }); }} aria-label="Skip rest timer"><X size={18}/></button></div></aside>}

      {workout.exercises.length > 1 && <nav className="exercise-jump-nav" aria-label="Jump to exercise"><span>JUMP TO</span>{workout.exercises.map((exercise, index) => <button key={exercise.id} onClick={() => document.getElementById(`exercise-${exercise.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}>{String(index + 1).padStart(2, "0")} {exercise.name}</button>)}</nav>}

      <div className="section-heading"><div><h2>Your exercises</h2><p className={styles.sectionHint}>Enter your numbers, then tap ✓ to log a set.</p></div><button className={styles.addExercise} aria-expanded={pickerOpen} onClick={() => setPickerOpen(!pickerOpen)}>{pickerOpen ? <X size={18} /> : <Plus size={18} />}{pickerOpen ? "Close" : "Add exercise"}</button></div>

      {pickerOpen && <ExercisePicker catalog={catalog} preferences={preferences} addedIds={workout.exercises.map(exercise => exercise.exerciseId)} onAdd={addExercise} onClose={() => setPickerOpen(false)}/>}

      {workout.exercises.length === 0 && !pickerOpen && <section className="empty-exercises"><div className="empty-mark"><Dumbbell size={25} /></div><h3>What are we training?</h3><p>Find a movement by name or muscle group to begin.</p><button className={styles.primary} onClick={() => setPickerOpen(true)}><Plus size={18}/> Add your first exercise</button></section>}

      {livePr&&<p className="pr-celebration" role="status">{livePr}<button className="icon-button" aria-label="Dismiss record" onClick={()=>setLivePr("")}><X size={14}/></button></p>}
      <section className="exercise-stack"><GroupedExercises exercises={workout.exercises} render={(exercise, exerciseIndex) => <article className="exercise-card" id={`exercise-${exercise.id}`} key={exercise.id}>
        <header className="exercise-card-head"><div className="exercise-title"><span className="exercise-order">{String(exerciseIndex + 1).padStart(2, "0")}</span><div><h3>{exercise.name}</h3><p>{exercise.muscle} <span>·</span> {exercise.equipment}{exercise.targetRepMin && exercise.targetRepMax ? <span> · {exercise.targetRepMin}–{exercise.targetRepMax} reps</span> : null}{exercise.targetRpe!=null?<span> · target RPE {exercise.targetRpe}</span>:null}</p></div></div><div className="exercise-actions"><button className="icon-button" aria-label={`Move ${exercise.name} up`} disabled={exerciseIndex === 0} onClick={() => moveExercise(exercise.id, -1)}><ArrowUp size={15}/></button><button className="icon-button" aria-label={`Move ${exercise.name} down`} disabled={exerciseIndex === workout.exercises.length - 1} onClick={() => moveExercise(exercise.id, 1)}><ArrowDown size={15}/></button><button className="icon-button remove-button" aria-label={`Remove ${exercise.name}`} onClick={() => removeExercise(exercise.id)}><Trash2 size={16} /></button></div></header>
        <div className="last-time"><span>LAST TIME</span><span>{previousByExercise.get(exercise.exerciseId)?.sets.filter((set) => set.completed).map((set) => `${set.weight===null?"BW":formatWeight(set.weight,units)} × ${set.reps??"—"}${set.rir!=null?` @ RIR ${set.rir}`:set.rpe!=null?` @ RPE ${set.rpe}`:""}`).join("  ·  ") || "No previous session recorded"}</span></div>
        <div className="set-table"><div className="set-table-head"><span>SET</span><span>{weightUnit(units).toUpperCase()}</span><span>REPS</span><span>{profilePreferences.effortSystem.toUpperCase()}</span><span>DONE</span></div>{exercise.sets.map((set, index) => <div className={`set-row ${set.completed ? "set-row-done" : ""} ${set.setType === "warmup" ? "set-row-warmup" : ""}`} key={set.id}>
          <div className="set-index">{set.setType === "warmup" ? "W" : index + 1}</div>
          <div className="number-stepper"><button type="button" aria-label={`Decrease set ${index + 1} weight`} onClick={() => adjustSetValue(exercise.id, set.id, "weight", -2.5)}>−</button><input aria-label={`Set ${index + 1} weight`} inputMode="decimal" type="number" min="0" step="0.5" placeholder="—" value={set.weight === null ? "" : Number(toDisplayWeight(set.weight,units).toFixed(2))} onChange={(event) => updateSet(exercise.id, set.id, { weight: event.target.value === "" ? null : Math.max(0, fromDisplayWeight(Number(event.target.value),units)) })} /><button type="button" aria-label={`Increase set ${index + 1} weight`} onClick={() => adjustSetValue(exercise.id, set.id, "weight", 2.5)}>+</button></div>
          <div className="number-stepper"><button type="button" aria-label={`Decrease set ${index + 1} reps`} onClick={() => adjustSetValue(exercise.id, set.id, "reps", -1)}>−</button><input aria-label={`Set ${index + 1} reps`} inputMode="numeric" type="number" min="0" step="1" placeholder="—" value={set.reps ?? ""} onChange={(event) => updateSet(exercise.id, set.id, { reps: event.target.value === "" ? null : Math.max(0, Math.floor(Number(event.target.value))) })} /><button type="button" aria-label={`Increase set ${index + 1} reps`} onClick={() => adjustSetValue(exercise.id, set.id, "reps", 1)}>+</button></div>
          <select className="effort-selector" aria-label={`Set ${index+1} ${profilePreferences.effortSystem.toUpperCase()}`} value={(profilePreferences.effortSystem==="rir"?set.rir:set.rpe)??""} onChange={event=>updateSet(exercise.id,set.id,{[profilePreferences.effortSystem]:event.target.value===""?null:Number(event.target.value)})}><option value="">—</option>{Array.from({length:profilePreferences.effortSystem==="rir"?6:10},(_,i)=>profilePreferences.effortSystem==="rir"?i:i+1).map(v=><option key={v} value={v}>{v}</option>)}</select>
          <div className="set-row-actions"><button className={`complete-set ${set.completed ? "complete-set-active" : ""}`} aria-label={set.completed ? `Undo set ${index + 1}` : `Complete set ${index + 1}`} onClick={() => completeSet(exercise, set)}>{set.completed ? <Check size={17} /> : <CheckCircle2 size={19} />}</button><details className="set-actions"><summary aria-label={`Set ${index + 1} actions`}>···</summary><div className="set-action-menu"><button onClick={() => moveSet(exercise.id, set.id, -1)} disabled={index === 0}><ArrowUp size={13}/> Move up</button><button onClick={() => moveSet(exercise.id, set.id, 1)} disabled={index === exercise.sets.length - 1}><ArrowDown size={13}/> Move down</button><button onClick={() => duplicateSet(exercise.id, set)}><Copy size={13}/> Duplicate</button><button onClick={() => removeSet(exercise.id, set.id)} disabled={exercise.sets.length < 2}><Trash2 size={13}/> Delete</button></div></details></div>
        <details className="effort-picks"><summary>Set {index+1} · tap {profilePreferences.effortSystem.toUpperCase()} value</summary><div role="group" aria-label={`Choose effort for set ${index+1}`}>{Array.from({length:profilePreferences.effortSystem==="rir"?6:10},(_,i)=>profilePreferences.effortSystem==="rir"?i:i+1).map(value=><button type="button" key={value} aria-pressed={(profilePreferences.effortSystem==="rir"?set.rir:set.rpe)===value} onClick={()=>updateSet(exercise.id,set.id,{[profilePreferences.effortSystem]:value})}>{value}</button>)}</div></details></div>)}</div>
        <div className="feature-exercise-settings"><label>Rest · seconds<input type="number" min="0" max="1800" value={exercise.restSeconds} onChange={event=>persist({...workout,exercises:workout.exercises.map(e=>e.id===exercise.id?{...e,restSeconds:Math.max(0,Math.min(1800,Number(event.target.value)))}:e)})}/></label>{exercise.suggestedChange!==undefined&&<span className={exercise.suggestedChange>0?"delta-positive":exercise.suggestedChange<0?"delta-negative":""}>{exercise.suggestedChange===0?"= Same load":`${exercise.suggestedChange>0?"↑":"↓"} ${formatWeight(Math.abs(exercise.suggestedChange),units)}`}</span>}</div><div className="set-footer-actions"><button className="add-set-button" onClick={() => addSet(exercise.id)}><Plus size={15} /> Add set</button><button className="text-action warmup-action" onClick={() => addWarmupSets(exercise.id)}><Flame size={14}/> Add warm-up</button></div>
      </article>}/></section>

      <details className={styles.tools}><summary><span>Session tools <small>Supersets & plate calculator</small></span><ChevronDown size={18}/></summary>{workout.exercises.length > 1 && <GroupExercises exercises={workout.exercises} onChange={exercises=>persist({...workout,exercises})}/>}<PlateCalculator key={units}/></details>

      <details className="feature-panel" open={Boolean(workout.notes)}><summary>Session notes & journal</summary><label className="notes-field"><span>SESSION NOTES</span><textarea maxLength={4000} placeholder="How are you feeling? Sleep quality? Energy level?" value={workout.notes} onChange={(event) => persist({ ...workout, notes: event.target.value })} /></label></details>
      <div className="tag-picker">{["Poor Sleep","High Energy","Fatigued","Great Session","Minor Pain"].map(tag=><button className={(workout.tags??[]).includes(tag)?"selected":""} aria-pressed={(workout.tags??[]).includes(tag)} key={tag} onClick={()=>persist({...workout,tags:(workout.tags??[]).includes(tag)?workout.tags?.filter(t=>t!==tag):[...(workout.tags??[]),tag]})}>{tag}</button>)}</div>
      <details className={styles.workoutOptions}><summary>Workout options <ChevronDown size={16}/></summary><p>Deleting removes this session and all of its sets from this device.</p><button className={styles.deleteWorkout} disabled={busy !== null} onClick={() => void cancelWorkout()}><Trash2 size={16}/> {busy === "deleting" ? "Deleting…" : "Delete workout"}</button></details>
      <p className={styles.sessionFootnote}><ShieldCheck size={14}/> You can leave and return. Your session stays on this device.</p>
      </fieldset>
    </main>
  );
}

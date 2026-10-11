"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Dumbbell } from "lucide-react";
import { getMuscleFatigue, MUSCLE_GROUPS, type MuscleActivity, type MuscleGroup } from "@/features/recovery/muscle-groups";
import styles from "./body-heatmap.module.css";

type View = "front" | "back";
type MuscleShape = { id: MuscleGroup; d: string };
const front: MuscleShape[] = [
  { id: "shoulders", d: "M67 54 Q53 51 47 64 L53 80 Q61 77 68 69 M113 54 Q127 51 133 64 L127 80 Q119 77 112 69" },
  { id: "chest", d: "M69 67 Q77 61 89 66 L89 84 Q78 86 67 78 Z M111 67 Q103 61 91 66 L91 84 Q102 86 113 78 Z" },
  { id: "biceps", d: "M52 82 Q58 77 64 80 L62 106 Q58 111 52 106 Z M128 82 Q122 77 116 80 L118 106 Q122 111 128 106 Z" },
  { id: "forearms", d: "M51 111 L56 108 L52 143 L46 141 Z M129 111 L124 108 L128 143 L134 141 Z" },
  { id: "abs", d: "M78 88 Q90 85 102 88 L100 122 Q90 127 80 122 Z" },
  { id: "quads", d: "M74 132 Q84 128 89 134 L87 190 Q78 194 70 185 Z M106 132 Q96 128 91 134 L93 190 Q102 194 110 185 Z" },
  { id: "calves", d: "M75 204 Q82 199 87 203 L85 244 Q79 249 74 243 Z M105 204 Q98 199 93 203 L95 244 Q101 249 106 243 Z" },
];
const back: MuscleShape[] = [
  { id: "traps", d: "M79 62 Q90 54 101 62 L109 75 L101 83 L91 76 L81 83 L71 75 Z" },
  { id: "shoulders", d: "M67 54 Q53 51 47 64 L53 80 Q61 77 68 69 M113 54 Q127 51 133 64 L127 80 Q119 77 112 69" },
  { id: "upper_back", d: "M70 76 L89 80 L89 108 L72 104 Z M110 76 L91 80 L91 108 L108 104 Z" },
  { id: "lats", d: "M72 83 Q79 82 87 91 L85 126 Q76 129 68 116 Z M108 83 Q101 82 93 91 L95 126 Q104 129 112 116 Z" },
  { id: "triceps", d: "M52 82 Q58 77 64 80 L62 106 Q58 111 52 106 Z M128 82 Q122 77 116 80 L118 106 Q122 111 128 106 Z" },
  { id: "forearms", d: "M51 111 L56 108 L52 143 L46 141 Z M129 111 L124 108 L128 143 L134 141 Z" },
  { id: "glutes", d: "M75 126 Q90 119 105 126 L107 146 Q100 155 90 148 Q80 155 73 146 Z" },
  { id: "hamstrings", d: "M74 149 Q84 149 88 155 L86 194 Q78 198 70 190 Z M106 149 Q96 149 92 155 L94 194 Q102 198 110 190 Z" },
  { id: "calves", d: "M75 204 Q82 199 87 203 L85 244 Q79 249 74 243 Z M105 204 Q98 199 93 203 L95 244 Q101 249 106 243 Z" },
];
const labels: Record<MuscleGroup, string> = { chest: "Chest", lats: "Lats", upper_back: "Upper back", traps: "Traps", shoulders: "Shoulders", biceps: "Biceps", triceps: "Triceps", forearms: "Forearms", abs: "Abs", quads: "Quads", hamstrings: "Hamstrings", glutes: "Glutes", calves: "Calves" };

function fatigueLabel(level: ReturnType<typeof getMuscleFatigue>) { return level === "high" ? "Repairing" : level === "medium" ? "Rebuilding" : level === "nearly-recovered" ? "Nearly recovered" : "Fresh"; }
function hoursAgo(value: string) { return Math.max(0, (Date.now() - Date.parse(value)) / 3_600_000); }

export function BodyHeatmap() {
  const [view, setView] = useState<View>("front");
  const [activities, setActivities] = useState<MuscleActivity[]>([]);
  const [selected, setSelected] = useState<MuscleGroup | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "signed-out" | "error">("loading");
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/recovery/muscles", { cache: "no-store" }).then(async (response) => {
      if (response.status === 401) { if (!cancelled) setStatus("signed-out"); return; }
      if (!response.ok) throw new Error("Could not load recovery data");
      const data = await response.json() as { muscles?: MuscleActivity[] };
      if (!cancelled) { setActivities(Array.isArray(data.muscles) ? data.muscles : []); setStatus("ready"); }
    }).catch(() => { if (!cancelled) setStatus("error"); });
    return () => { cancelled = true; };
  }, []);

  const activityMap = useMemo(() => new Map(activities.map((item) => [item.muscle, item])), [activities]);
  const selectedActivity = selected ? activityMap.get(selected) : undefined;
  const lastHours = selectedActivity ? hoursAgo(selectedActivity.lastWorkedAt) : null;
  const activeShapes = view === "front" ? front : back;
  const fatigueFor = (muscle: MuscleGroup) => getMuscleFatigue(activityMap.has(muscle) ? hoursAgo(activityMap.get(muscle)!.lastWorkedAt) : null);

  return <section className={styles.card} aria-labelledby="muscle-heatmap-title">
    <div className={styles.heading}><div><p className={styles.eyebrow}>RECOVERY MAP</p><h2 id="muscle-heatmap-title">Muscle activity</h2></div><div className={styles.toggle} role="group" aria-label="Body view"><button type="button" aria-pressed={view === "front"} onClick={() => setView("front")}>Front</button><button type="button" aria-pressed={view === "back"} onClick={() => setView("back")}>Back</button></div></div>
    <p className={styles.description}>Recent completed working sets, grouped by primary muscle.</p>
    {status === "loading" ? <div className={styles.skeleton} role="status" aria-label="Loading muscle activity"/> : status === "signed-out" ? <div className={styles.empty}><Dumbbell size={19}/><span>Sign in to see your recovery map.</span><Link href="/login">Sign in <ArrowUpRight size={14}/></Link></div> : status === "error" ? <p className={styles.emptyText} role="status">Recent activity could not be loaded.</p> : <>
      <div className={styles.bodyArea}>
        <svg className={styles.figure} viewBox="0 0 180 270" role="img" aria-label={`${view === "front" ? "Front" : "Back"} muscle anatomy map`}>
          <path className={styles.silhouette} d="M90 13c-12 0-19 9-19 21 0 9 4 16 10 19l-9 5c-14 2-25 11-28 24l-9 35 9 4 13-30 1 36 9 3-3 61 9 2 8-53 9 53 9-2-3-61 9-3 1-36 13 30 9-4-9-35c-3-13-14-22-28-24l-9-5c6-3 10-10 10-19 0-12-7-21-19-21zm-9 178-9 53 8 2 10-48 10 48 8-2-9-53z"/>
          {activeShapes.map((shape) => <path key={`${view}-${shape.id}`} data-muscle={shape.id} className={`${styles.muscle} ${styles[`fatigue_${fatigueFor(shape.id)}`]} ${selected === shape.id ? styles.selected : ""}`} d={shape.d} tabIndex={0} role="button" aria-label={`${labels[shape.id]}: ${activityMap.get(shape.id)?.sets ?? 0} working sets in the last 72 hours`} onMouseEnter={() => setSelected(shape.id)} onFocus={() => setSelected(shape.id)} onClick={() => setSelected(selected === shape.id ? null : shape.id)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setSelected(shape.id); } }}/>) }
        </svg>
        <div className={styles.legend} aria-label="Recovery status legend"><span><i data-level="high"/>0–24h</span><span><i data-level="medium"/>24–48h</span><span><i data-level="nearly-recovered"/>48–72h</span><span><i data-level="fresh"/>Ready</span></div>
      </div>
      {selected && <div className={styles.detail} aria-live="polite"><div><strong>{labels[selected]}</strong><span>{selectedActivity ? `${selectedActivity.sets} ${selectedActivity.sets === 1 ? "set" : "sets"} logged ${lastHours !== null && lastHours < 24 ? "today" : `${Math.floor((lastHours ?? 0) / 24)}d ago`}` : "No sets logged in the last 72 hours"}</span></div><b>{fatigueLabel(fatigueFor(selected))}{lastHours !== null && lastHours < 72 ? ` · est. ${Math.ceil(72 - lastHours)}h to full recovery` : ""}</b></div>}
      {status === "ready" && activities.length === 0 && <p className={styles.emptyText}>Your recent muscle activity will appear after you sync a completed workout.</p>}
      <p className={styles.note}>Recovery time is a simple 72-hour guide based on your log, not a measure of readiness or medical advice. {MUSCLE_GROUPS.length} groups tracked.</p>
    </>}
  </section>;
}

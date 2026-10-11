"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Dumbbell } from "lucide-react";
import { getMuscleFatigue, MUSCLE_GROUPS, type MuscleActivity, type MuscleGroup } from "@/features/recovery/muscle-groups";
import styles from "./body-heatmap.module.css";

type View = "front" | "back";
type MuscleShape = { id: MuscleGroup; d: string };
const front: MuscleShape[] = [
  { id: "shoulders", d: "M65 58 Q54 58 51 70 L52 81 Q59 80 65 73 L69 62 Z M115 58 Q126 58 129 70 L128 81 Q121 80 115 73 L111 62 Z" },
  { id: "chest", d: "M71 65 Q79 61 88 67 L88 85 Q77 89 67 80 L67 72 Z M109 65 Q101 61 92 67 L92 85 Q103 89 113 80 L113 72 Z" },
  { id: "biceps", d: "M52 85 Q58 84 62 80 L60 102 Q58 111 49 112 L48 105 Z M128 85 Q122 84 118 80 L120 102 Q122 111 131 112 L132 105 Z" },
  { id: "forearms", d: "M48 116 L56 114 Q54 128 47 143 L42 141 Z M132 116 L124 114 Q126 128 133 143 L138 141 Z" },
  { id: "abs", d: "M79 92 Q90 89 101 92 L100 104 L92 106 L92 126 L88 126 L88 106 L80 104 Z M80 108 L86 109 L86 124 L81 120 Z M100 108 L94 109 L94 124 L99 120 Z" },
  { id: "quads", d: "M76 139 Q82 133 87 140 L85 175 L82 194 L75 191 Q69 176 73 156 Z M104 139 Q98 133 93 140 L95 175 L98 194 L105 191 Q111 176 107 156 Z" },
  { id: "calves", d: "M76 205 Q82 202 84 209 L82 232 L78 245 L73 245 L72 227 Z M104 205 Q98 202 96 209 L98 232 L102 245 L107 245 L108 227 Z" },
];
const back: MuscleShape[] = [
  { id: "traps", d: "M81 54 L88 56 L88 79 L73 66 Z M99 54 L92 56 L92 79 L107 66 Z" },
  front[0],
  { id: "upper_back", d: "M72 71 L86 82 L86 101 L72 91 L68 79 Z M108 71 L94 82 L94 101 L108 91 L112 79 Z" },
  { id: "lats", d: "M69 85 L83 103 L86 123 L77 127 Q72 115 70 104 Z M111 85 L97 103 L94 123 L103 127 Q108 115 110 104 Z" },
  { id: "triceps", d: front[2].d },
  front[3],
  { id: "glutes", d: "M76 130 Q82 127 88 131 L88 150 Q80 156 72 148 Z M104 130 Q98 127 92 131 L92 150 Q100 156 108 148 Z" },
  { id: "hamstrings", d: "M73 154 Q80 158 87 155 L85 178 L82 194 L75 191 Q70 175 73 154 Z M107 154 Q100 158 93 155 L95 178 L98 194 L105 191 Q110 175 107 154 Z" },
  front[6],
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
    {status === "loading" ? <div className={styles.skeleton} role="status" aria-label="Loading muscle activity"/> : status === "signed-out" ? <div className={styles.empty}><Dumbbell size={19}/><span>Sign in to see your recovery map.</span><Link className={styles.accountAction} href="/login">Sign in <ArrowUpRight size={14}/></Link></div> : status === "error" ? <p className={styles.emptyText} role="status">Recent activity could not be loaded.</p> : <>
      <div className={styles.bodyArea}>
        <svg className={styles.figure} viewBox="0 0 180 270" role="group" aria-label={`${view === "front" ? "Front" : "Back"} muscle anatomy map`}>
          <ellipse className={styles.silhouette} cx="90" cy="29" rx="12" ry="17"/>
          <path className={styles.silhouette} d="M83 46 L83 52 Q76 55 65 55 Q51 56 47 71 L44 103 L38 137 L35 150 Q38 155 43 153 L48 146 L60 115 L65 88 L68 105 L74 126 Q69 140 68 160 L69 187 L73 201 Q68 220 69 238 L69 250 L65 256 Q73 261 81 256 L84 237 L87 213 L87 197 L90 156 L93 197 L93 213 L96 237 L99 256 Q107 261 115 256 L111 250 L111 238 Q112 220 107 201 L111 187 L112 160 Q111 140 106 126 L112 105 L115 88 L120 115 L132 146 L137 153 Q142 155 145 150 L142 137 L136 103 L133 71 Q129 56 115 55 Q104 55 97 52 L97 46 Z"/>
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

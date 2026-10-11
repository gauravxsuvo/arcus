"use client";

import { useEffect, useState } from "react";
import { Check, Moon, X } from "lucide-react";
import { ReadinessWidget, type SleepLogView } from "./ReadinessWidget";
import dynamic from "next/dynamic";
import { calculateReadiness, localDateKey } from "@/features/recovery/readiness-engine";
import { useToast } from "@/components/shared/toast-provider";
import styles from "./recovery.module.css";

const SleepTrendCard = dynamic(() => import("./SleepTrendCard").then(module => module.SleepTrendCard), {
  ssr: false,
  loading: () => <section className={styles.card} aria-hidden="true" style={{ minHeight: 230 }} />,
});

type Tag = "LATE_CAFFEINE" | "SORENESS" | "LATE_MEAL" | "MELATONIN" | "RESTLESS";
type RecoveryResponse = { today: SleepLogView | null; logs: SleepLogView[] };
const TAGS: Array<{ value: Tag; label: string }> = [
  { value: "LATE_CAFFEINE", label: "Late caffeine" }, { value: "SORENESS", label: "Soreness" },
  { value: "LATE_MEAL", label: "Late meal" }, { value: "MELATONIN", label: "Melatonin" }, { value: "RESTLESS", label: "Restless" },
];

function localInputValue(date: Date) {
  return `${localDateKey(date)}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}
function timeDefaults() {
  const wake = new Date(); wake.setHours(7, 0, 0, 0);
  const bed = new Date(wake); bed.setDate(bed.getDate() - 1); bed.setHours(23, 0, 0, 0);
  return { bed: localInputValue(bed), wake: localInputValue(wake) };
}

export function SleepCheckInModal({ showTrend = true }: { showTrend?: boolean }) {
  const { showToast } = useToast();
  const [data, setData] = useState<RecoveryResponse | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [signedOut, setSignedOut] = useState(false);
  const [open, setOpen] = useState(false);
  const [bedtime, setBedtime] = useState("");
  const [wakeTime, setWakeTime] = useState("");
  const [qualityRating, setQualityRating] = useState<1 | 2 | 3>(2);
  const [tags, setTags] = useState<Tag[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const today = localDateKey(new Date());
  useEffect(() => {
    let cancelled = false;
    void fetch(`/api/recovery/sleep?date=${today}`, { credentials: "include", cache: "no-store" })
      .then(async response => {
        if (response.status === 401) { if (!cancelled) setSignedOut(true); return null; }
        if (!response.ok) throw new Error("Could not load your recovery data.");
        return await response.json() as RecoveryResponse;
      })
      .then(value => { if (value && !cancelled) setData(value); })
      .catch(() => { if (!cancelled) setError("Your recovery data could not load. Try refreshing."); })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [today]);

  const duration = bedtime && wakeTime ? Math.round((new Date(wakeTime).getTime() - new Date(bedtime).getTime()) / 60_000) : 0;
  function begin() {
    const defaults = timeDefaults();
    setBedtime(data?.today ? localInputValue(new Date(data.today.bedtime)) : defaults.bed);
    setWakeTime(data?.today ? localInputValue(new Date(data.today.wakeTime)) : defaults.wake);
    setQualityRating(data?.today?.qualityRating ?? 2);
    setTags((data?.today?.tags ?? []) as Tag[]);
    setNotes(data?.today?.notes ?? "");
    setError(""); setMessage(""); setOpen(true);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    let previousData = data;
    try {
      const bed = new Date(bedtime); const wake = new Date(wakeTime);
      const date = localDateKey(wake);
      const optimisticLog: SleepLogView = {
        id: `pending-${Date.now()}`, date, bedtime: bed.toISOString(), wakeTime: wake.toISOString(), durationMinutes: duration,
        qualityRating, readinessScore: calculateReadiness(duration, qualityRating, false).score, tags, notes,
      };
      previousData = data;
      setData(previous => ({ today: optimisticLog, logs: [...(previous?.logs.filter(item => item.date !== date) ?? []), optimisticLog].sort((a,b) => a.date.localeCompare(b.date)) }));
      setMessage("Saving your sleep check-in…");
      const response = await fetch("/api/recovery/sleep", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: localDateKey(wake), bedtime: bed.toISOString(), wakeTime: wake.toISOString(), timezoneOffsetMinutes: wake.getTimezoneOffset(), qualityRating, tags, notes }) });
      const result = await response.json() as { error?: string; log?: SleepLogView; readiness?: { score: number } };
      if (!response.ok || !result.log) throw new Error(result.error ?? "Your check-in could not be saved.");
      setData(previous => ({ today: result.log!, logs: [...(previous?.logs.filter(item => item.date !== result.log!.date) ?? []), result.log!].sort((a,b) => a.date.localeCompare(b.date)) }));
      const successMessage = `Check-in saved · ${result.readiness?.score ?? result.log.readinessScore}% readiness`;
      setMessage(successMessage); showToast(successMessage); setOpen(false);
    } catch (reason) { setData(previousData); setMessage(""); const errorMessage = reason instanceof Error ? reason.message : "Your check-in could not be saved."; setError(errorMessage); showToast(errorMessage, "error"); }
    finally { setBusy(false); }
  }

  function toggleTag(value: Tag) { setTags(current => current.includes(value) ? current.filter(item => item !== value) : [...current, value]); }
  const noLog = !data?.today;
  return <div className={styles.stack}>
    {!loaded ? <section className={styles.card} role="status"><p className={styles.subtle}>Loading your recovery…</p></section> : signedOut ? <section className={`${styles.card} ${styles.prompt}`}><div className={styles.promptCopy}><p className={styles.kicker}>SLEEP & READINESS</p><h2 className={styles.title}>Your recovery, made visible.</h2><p className={styles.subtle}>Sign in to save sleep check-ins and see readiness trends.</p></div><a className={styles.action} href="/login">Sign in</a></section> : noLog ? <section className={`${styles.card} ${styles.prompt}`}><div className={styles.promptCopy}><p className={styles.kicker}>MORNING CHECK-IN</p><h2 className={styles.title}>🌙 How did you sleep last night?</h2><p className={styles.subtle}>A quick check-in gives your next session useful recovery context.</p></div><button className={styles.action} type="button" onClick={begin}><Moon size={16}/> Log morning check-in</button></section> : null}
    {error && !open && <p className={styles.error} role="alert">{error}</p>}
    {message && <p className={styles.result} role="status"><Check size={15}/> {message}</p>}
    {data?.today && <ReadinessWidget log={data.today} recommendation={data.today.readinessScore >= 80 ? "Prime recovery. Train with confidence and keep good form." : data.today.readinessScore >= 60 ? "A steady day. Match the session to how you feel." : "Consider a lighter session and pay attention to fatigue."}/>}
    {showTrend && loaded && !signedOut && <SleepTrendCard initialLogs={data?.logs ?? []}/>}
    {open && <div className={styles.dialogBackdrop} role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !busy) setOpen(false); }}><section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="sleep-dialog-title">
      <div className={styles.dialogHead}><div><p className={styles.kicker}>MORNING CHECK-IN</p><h2 id="sleep-dialog-title">How was your sleep?</h2><p>Saved privately to your ARCUS account.</p></div><button className={styles.iconButton} type="button" aria-label="Close sleep check-in" onClick={() => setOpen(false)}><X size={18}/></button></div>
      <form className={styles.form} onSubmit={event => void submit(event)}>
        <div className={styles.timeGrid}><label className={styles.field}>Bedtime<input type="datetime-local" value={bedtime} onChange={event => setBedtime(event.target.value)} required/></label><label className={styles.field}>Wake time<input type="datetime-local" value={wakeTime} onChange={event => setWakeTime(event.target.value)} required/></label></div>
        <p className={styles.duration}>⚡ {duration > 0 ? `${Math.floor(duration / 60)} hrs ${String(duration % 60).padStart(2,"0")} mins of sleep` : "Choose a wake time after bedtime"}</p>
        <fieldset className={styles.field} style={{ border: 0, padding: 0, margin: 0 }}><legend>How rested do you feel?</legend><div className={styles.quality}>{([[1,"🥱 Exhausted"],[2,"⚡ Decent"],[3,"🔥 Fully rested"]] as const).map(([value,label]) => <button key={value} type="button" aria-pressed={qualityRating === value} onClick={() => setQualityRating(value)}>{label}</button>)}</div></fieldset>
        <fieldset className={styles.field} style={{ border: 0, padding: 0, margin: 0 }}><legend>Anything affect your sleep?</legend><div className={styles.tags}>{TAGS.map(tag => <button className={styles.tag} key={tag.value} type="button" aria-pressed={tags.includes(tag.value)} onClick={() => toggleTag(tag.value)}>{tag.label}</button>)}</div></fieldset>
        <label className={styles.field}>Notes (optional)<textarea rows={2} maxLength={500} value={notes} onChange={event => setNotes(event.target.value)} placeholder="Anything you want to remember?"/></label>
        {error && <p className={styles.error} role="alert">{error}</p>}
        <div className={styles.modalActions}><button className={styles.secondary} type="button" disabled={busy} onClick={() => setOpen(false)}>Cancel</button><button className={styles.action} type="submit" disabled={busy || duration < 30 || duration > 1440}>{busy ? "Saving…" : "Save check-in"}</button></div>
      </form>
    </section></div>}
  </div>;
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, Scale, X } from "lucide-react";
import { saveWeightLogAction } from "@/app/actions/weight";
import { useToast } from "@/components/shared/toast-provider";
import { toDisplayWeight, weightUnit } from "@/features/training/logic";
import type { WeightLog } from "@/features/weight/weight-trend";
import styles from "./weight.module.css";

function localDateKey(date = new Date()) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function parseWeightInput(value: string) { return Number(value.replace(",", ".")); }
type UnitPreference = "metric" | "imperial";

export function QuickWeightModal({ units }: { units: UnitPreference }) {
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [latest, setLatest] = useState<WeightLog | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const unit = weightUnit(units) === "lb" ? "lbs" : "kg";

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/recovery/weight", { cache: "no-store" }).then(async (response) => {
      if (response.status === 401) return;
      if (!response.ok) throw new Error("Could not load prior weigh-in");
      const data = await response.json() as { logs?: WeightLog[] };
      if (!cancelled) setLatest(data.logs?.[0] ?? null);
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, []);
  useEffect(() => { if (open) { setValue(latest ? toDisplayWeight(latest.unit === "lbs" ? latest.weight * 0.45359237 : latest.weight, units).toFixed(1) : ""); requestAnimationFrame(() => inputRef.current?.focus()); } }, [open, latest, units]);

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    const weight = parseWeightInput(value);
    const today = localDateKey();
    if (!Number.isFinite(weight) || weight <= 0 || (unit === "kg" && weight > 500) || (unit === "lbs" && weight > 1100)) { setError(`Enter a valid weight in ${unit}.`); return; }
    setBusy(true);
    const optimistic: WeightLog = { date: today, weight, unit, notes: notes.trim() || null };
    window.dispatchEvent(new CustomEvent("arcus-weight-log-updated", { detail: { log: optimistic, optimistic: true } }));
    try {
      const result = await saveWeightLogAction(optimistic);
      if (!result.ok) throw new Error(result.error);
      setLatest(result.log); setOpen(false); setNotes(""); showToast("Weigh-in saved.");
      window.dispatchEvent(new CustomEvent("arcus-weight-log-updated", { detail: { log: result.log, optimistic: false } }));
    } catch (reason) {
      window.dispatchEvent(new CustomEvent("arcus-weight-log-updated", { detail: { rollback: true } }));
      setError(reason instanceof Error ? reason.message : "Could not save weigh-in.");
    } finally { setBusy(false); }
  }

  return <>
    <button type="button" className={styles.openButton} onClick={() => setOpen(true)}><Scale size={17}/> Log weight</button>
    {open && <div className={styles.backdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setOpen(false); }}><section className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="quick-weight-title"><header><div><p className={styles.eyebrow}>MORNING CHECK-IN</p><h2 id="quick-weight-title">Log bodyweight</h2></div><button type="button" aria-label="Close weigh-in form" onClick={() => setOpen(false)} disabled={busy}><X size={20}/></button></header><form onSubmit={(event) => void save(event)}><label className={styles.weightField}><span>WEIGHT · {unit.toUpperCase()}</span><input ref={inputRef} autoComplete="off" inputMode="decimal" pattern="[0-9]*[.,]?[0-9]*" min="20" max={unit === "kg" ? "500" : "1100"} step="0.1" value={value} onChange={(event) => setValue(event.target.value)} required placeholder="e.g. 72.4"/><small>{latest ? `Previous: ${toDisplayWeight(latest.unit === "lbs" ? latest.weight * 0.45359237 : latest.weight, units).toFixed(1)} ${unit}` : "Weigh in under similar conditions for a useful trend."}</small></label><label className={styles.notesField}><span>NOTE · OPTIONAL</span><input maxLength={300} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Morning, before breakfast…"/></label>{error && <p className={styles.error} role="alert">{error}</p>}<button className={styles.saveButton} disabled={busy}>{busy ? <><LoaderCircle className="saving-spinner" size={17}/> Saving…</> : <><Check size={17}/> Save weigh-in</>}</button></form></section></div>}
  </>;
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, Download, FileUp, History, ShieldCheck, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { exerciseCatalog } from "@/features/exercises/catalog";
import { deleteImportBatch, listCustomExercises, listImportBatches, saveImportBatch, type ImportBatch } from "@/features/local-data/repository";
import { buildFullBackup, buildGenericWorkoutCsv, buildWorkoutCsv } from "./backup";
import { downloadText, serializeCsv } from "./csv";
import { buildImportedWorkouts } from "./importer";
import { analyzeHevyCsv } from "./hevy/parser";
import type { ExerciseMatch, HevyAnalysis } from "./hevy/types";
import { deleteWorkoutsByImportBatch, getCompletedWorkouts, saveWorkouts } from "@/features/workouts/repository";
import { BackupRestore } from "@/components/profile/backup-restore";
import { HealthIntegrations } from "@/components/profile/health-integrations";

type Phase = "idle" | "review" | "importing" | "complete";

function today() { return new Date().toISOString().slice(0, 10); }

export function DataPanel() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [analysis, setAnalysis] = useState<HevyAnalysis | null>(null);
  const [fileName, setFileName] = useState("");
  const [unit, setUnit] = useState<"" | "kg" | "lb">("");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [message, setMessage] = useState("");
  const [progress, setProgress] = useState(0);

  useEffect(() => { void listImportBatches().then(setBatches).catch(() => undefined); }, []);

  const unresolved = useMemo(() => (analysis?.matches ?? []).filter((match) => match.status !== "matched"), [analysis]);
  const duplicate = Boolean(analysis && batches.some((batch) => batch.fileHash === analysis.fileHash));
  const needsUnit = Boolean(analysis?.rows.some((row) => row.weight !== null) && (analysis.unit === "unknown" || analysis.unit === "mixed") && !unit);

  async function analyzeFile(file: File) {
    setMessage("");
    if (file.size > 10 * 1024 * 1024) { setMessage("That file is larger than the 10 MB safety limit."); return; }
    if (!file.name.toLocaleLowerCase().endsWith(".csv")) { setMessage("Choose a CSV file."); return; }
    try {
      const custom = await listCustomExercises();
      const next = await analyzeHevyCsv(await file.text(), [...exerciseCatalog, ...custom]);
      // Keep imported names by default when a match is not certain. Users can
      // still select a catalog match in the review list before importing.
      const initialMapping = Object.fromEntries(next.matches.filter((match) => match.status !== "matched").map((match) => [match.sourceName, "custom"]));
      setFileName(file.name); setAnalysis(next); setMapping(initialMapping); setUnit(next.unit === "kg" || next.unit === "lb" ? next.unit : ""); setPhase("review");
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Could not analyze that CSV."); }
  }

  async function confirmImport() {
    if (!analysis || duplicate) return;
    if (needsUnit) { setMessage("Choose kg or lb before importing weights whose unit is not labelled."); return; }
    if (unresolved.some((match) => !mapping[match.sourceName])) { setMessage("Choose a match or keep the original name for each ambiguous exercise."); return; }
    setPhase("importing"); setProgress(10); setMessage("");
    try {
      const existing = await getCompletedWorkouts();
      const result = buildImportedWorkouts(analysis, [...exerciseCatalog, ...(await listCustomExercises())], (unit || "kg") as "kg" | "lb", existing, mapping);
      setProgress(45); await saveWorkouts(result.workouts); setProgress(90);
      const batch: ImportBatch = { id: result.batchId, source: result.source, filename: fileName, fileHash: result.fileHash, importedAt: new Date().toISOString(), workoutCount: result.workouts.length, setCount: result.workouts.reduce((sum, workout) => sum + workout.exercises.reduce((inner, exercise) => inner + exercise.sets.length, 0), 0), warningCount: analysis.issues.filter((issue) => issue.severity === "warning").length, skippedRows: result.skippedRows, status: "completed" };
      await saveImportBatch(batch); setBatches((current) => [batch, ...current]); setProgress(100); setPhase("complete");
      setMessage(result.workouts.length ? `${batch.workoutCount} workouts and ${batch.setCount} sets are now in your history.` : "That file was already represented in your local history.");
    } catch (reason) { setPhase("review"); setMessage(reason instanceof Error ? reason.message : "The import was not saved."); }
  }

  async function undo(batch: ImportBatch) {
    if (!window.confirm(`Undo ${batch.workoutCount} imported workouts from ${batch.filename}?`)) return;
    await deleteWorkoutsByImportBatch(batch.id); await deleteImportBatch(batch.id); setBatches((current) => current.filter((item) => item.id !== batch.id)); setMessage("That import batch was removed from this device.");
  }

  async function exportHevy() { downloadText(`hevy-export-${today()}.csv`, await buildWorkoutCsv(), "text/csv;charset=utf-8"); }
  async function exportGeneric() { downloadText(`workouts-${today()}.csv`, await buildGenericWorkoutCsv(), "text/csv;charset=utf-8"); }
  async function exportBackup() { downloadText(`full-backup-${today()}.json`, JSON.stringify(await buildFullBackup(), null, 2), "application/json;charset=utf-8"); }
  async function exportIssues() { if (analysis?.issues.length) downloadText("arcus-import-errors.csv", serializeCsv(["row", "severity", "issue"], analysis.issues.map((item) => ({ row: item.rowNumber, severity: item.severity, issue: item.issue }))), "text/csv;charset=utf-8"); }

  return <main className="workout-shell data-shell">
    <header className="workout-top"><Link className="back-link" href="/profile"><ArrowLeft size={17}/> Profile</Link><span className="offline-badge"><ShieldCheck size={13}/> LOCAL-FIRST DATA</span></header>
    <section className="history-heading"><p className="eyebrow"><span className="live-dot"/> DATA & MIGRATION</p><h1>Move your<br/><span>history safely.</span></h1><p>Analyze files on this device first. Nothing is written until you confirm the preview.</p></section>
    <section className="data-panel"><div className="data-panel-heading"><div><p className="eyebrow">IMPORT FROM HEVY</p><h2>Bring your training history</h2><p>Choose the workout CSV exported from Hevy. The parser also recognizes Strong-style columns used by Hevy&apos;s import flow.</p></div><FileUp className="data-panel-icon" size={24}/></div>
      <input ref={fileRef} className="visually-hidden" type="file" accept=".csv,text/csv" onChange={(event) => { const file = event.target.files?.[0]; if (file) void analyzeFile(file); event.currentTarget.value = ""; }}/>
      {phase === "idle" && <button className="action-button" onClick={() => fileRef.current?.click()}><Upload size={16}/> Choose CSV</button>}
      {phase === "review" && analysis && <div className="import-review"><div className="import-file-line"><strong>{fileName}</strong><span>{analysis.format.toUpperCase()} format · {analysis.unit.toUpperCase()} detected</span></div><div className="import-summary"><div><strong>{analysis.workoutCount}</strong><span>WORKOUTS</span></div><div><strong>{analysis.setCount}</strong><span>SETS</span></div><div><strong>{analysis.matches.filter((match) => match.status === "matched").length}</strong><span>MATCHED</span></div><div><strong>{analysis.issues.length}</strong><span>ISSUES</span></div></div>{analysis.dateRange.from && <p className="data-caption">Dates: {new Date(analysis.dateRange.from).toLocaleDateString()} → {new Date(analysis.dateRange.to ?? analysis.dateRange.from).toLocaleDateString()}</p>}{(needsUnit || analysis.unit === "mixed") && <><p className="data-warning">{analysis.unit === "mixed" ? "This file contains mixed or unclear weight units. Choose the unit to use for imported weights." : "Your CSV doesn’t label weights as kg or lb. Choose the unit used in this file to enable import."}</p><label className="data-field">Weight unit {analysis.unit === "mixed" ? "(required to continue)" : "(required)"}<select aria-label="Weight unit (required)" value={unit} onChange={(event) => setUnit(event.target.value as "" | "kg" | "lb")}><option value="">Choose unit…</option><option value="kg">Kilograms (kg)</option><option value="lb">Pounds (lb)</option></select></label></>}{unresolved.length > 0 && <div className="mapping-list"><p className="eyebrow">REVIEW EXERCISE MATCHES</p>{unresolved.map((match: ExerciseMatch) => <label className="mapping-row" key={match.sourceName}><span><strong>{match.sourceName}</strong><small>{match.status === "unknown" ? "Not found — keep as imported custom history" : "Choose the closest match or keep the original name"}</small></span><select value={mapping[match.sourceName] ?? ""} onChange={(event) => setMapping((current) => ({ ...current, [match.sourceName]: event.target.value }))}><option value="">Choose…</option><option value="custom">Keep original</option>{match.candidates.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></label>)}</div>}{duplicate && <p className="data-warning"><History size={15}/> This exact file has already been imported. No duplicate records will be created.</p>}{analysis.issues.length > 0 && <button className="text-action" onClick={() => void exportIssues()}>Download issue report</button>}<div className="data-actions">{(needsUnit || unresolved.some((match) => !mapping[match.sourceName])) && <p className="data-caption">Complete the required selections above to enable import.</p>}<button className="outline-button" onClick={() => { setAnalysis(null); setPhase("idle"); }}>Choose another</button><button className="action-button" disabled={duplicate || needsUnit || unresolved.some((match) => !mapping[match.sourceName])} onClick={() => void confirmImport()}><Check size={16}/> Confirm import</button></div></div>}
      {phase === "importing" && <div className="import-progress"><strong>Importing your workouts…</strong><div><i style={{ width: `${progress}%` }}/></div><span>{progress}% · local transaction in progress</span></div>}
      {phase === "complete" && <div className="import-complete"><Check size={22}/><strong>Your history is ready.</strong><p>{message}</p><button className="outline-button" onClick={() => { setPhase("idle"); setAnalysis(null); }}>Import another file</button></div>}
      {message && phase !== "complete" && <p className="data-message" role="status">{message}</p>}
    </section>
    <BackupRestore/><HealthIntegrations/><section className="data-panel"><div className="data-panel-heading"><div><p className="eyebrow">EXPORT YOUR DATA</p><h2>Take it with you</h2><p>Exports are created from this device and never include passwords, tokens, or server secrets.</p></div><Download className="data-panel-icon" size={24}/></div><div className="data-export-grid"><button className="outline-button" onClick={() => void exportHevy()}><Download size={15}/> Export for HEVY</button><button className="outline-button" onClick={() => void exportGeneric()}><Download size={15}/> Export workouts CSV</button><button className="outline-button" onClick={() => void exportBackup()}><Download size={15}/> Export all data JSON</button></div></section>
    <section className="data-panel"><div className="data-panel-heading"><div><p className="eyebrow">IMPORT HISTORY</p><h2>Recent batches</h2></div><History className="data-panel-icon" size={24}/></div>{batches.length === 0 ? <p className="data-caption">No imports yet.</p> : <div className="import-history">{batches.map((batch) => <div className="import-history-row" key={batch.id}><div><strong>{batch.source.toUpperCase()} · {batch.filename}</strong><small>{new Date(batch.importedAt).toLocaleString()} · {batch.workoutCount} workouts · {batch.setCount} sets</small></div><button className="icon-button" aria-label={`Undo import ${batch.filename}`} onClick={() => void undo(batch)}><Trash2 size={15}/></button></div>)}</div>}</section>
  </main>;
}

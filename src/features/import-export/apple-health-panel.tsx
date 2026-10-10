"use client";

import { useRef, useState } from "react";
import { Apple, Check, Upload } from "lucide-react";
import { listPhysiqueEntries, listImportBatches, saveImportBatch, savePhysiqueEntry, type ImportBatch } from "@/features/local-data/repository";
import { getCompletedWorkouts, saveWorkouts } from "@/features/workouts/repository";
import { parseAppleHealthExport, type AppleHealthImport } from "./apple-health";

async function hashText(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function AppleHealthImportPanel() {
  const input = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [fileHash, setFileHash] = useState("");
  const [analysis, setAnalysis] = useState<AppleHealthImport | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function inspect(file: File) {
    setMessage("");
    if (file.size > 100 * 1024 * 1024) { setMessage("This export is larger than the 100 MB safety limit."); return; }
    if (!file.name.toLowerCase().endsWith(".xml")) { setMessage("Choose the export.xml file from Apple Health."); return; }
    try {
      const content = await file.text();
      const [parsed, digest, batches] = await Promise.all([Promise.resolve(parseAppleHealthExport(content)), hashText(content), listImportBatches()]);
      if (batches.some((batch) => batch.fileHash === digest)) { setMessage("This exact Apple Health export was already imported."); return; }
      setFileName(file.name); setFileHash(digest); setAnalysis(parsed);
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "Could not read this Apple Health export."); }
  }

  async function confirmImport() {
    if (!analysis || busy) return;
    setBusy(true); setMessage("");
    try {
      const [workouts, entries] = await Promise.all([getCompletedWorkouts(), listPhysiqueEntries("bodyweight")]);
      const knownWorkoutKeys = new Set(workouts.map((item) => item.sourceFingerprint).filter((value): value is string => Boolean(value)));
      const knownMetricKeys = new Set(entries.map((item) => item.sourceFingerprint).filter((value): value is string => Boolean(value)));
      const batchId = crypto.randomUUID();
      const nextWorkouts = analysis.workouts.filter((item) => !knownWorkoutKeys.has(item.sourceFingerprint ?? ""))
        .map((item) => ({ ...item, importBatchId: batchId }));
      const nextMetrics = analysis.metrics.filter((item) => !knownMetricKeys.has(item.sourceFingerprint ?? ""))
        .map((item) => ({ ...item, importBatchId: batchId }));
      if (nextWorkouts.length) await saveWorkouts(nextWorkouts);
      for (const item of nextMetrics) await savePhysiqueEntry(item);
      const batch: ImportBatch = { id: batchId, source: "apple-health", filename: fileName, fileHash, importedAt: new Date().toISOString(), workoutCount: nextWorkouts.length, setCount: 0, metricCount: nextMetrics.length, warningCount: 0, skippedRows: analysis.skippedRows + analysis.workouts.length - nextWorkouts.length + analysis.metrics.length - nextMetrics.length, status: "completed" };
      await saveImportBatch(batch);
      window.dispatchEvent(new Event("arcus-import-history-updated"));
      setAnalysis(null);
      setMessage(`Imported ${nextWorkouts.length} workouts and ${nextMetrics.length} bodyweight entries. They’re saved on this device and queued for sync.`);
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : "The Apple Health import could not be saved."); }
    finally { setBusy(false); }
  }

  return <section className="data-panel"><div className="data-panel-heading"><div><p className="eyebrow">APPLE HEALTH EXPORT</p><h2>Bring in your health history</h2><p>Import workout sessions and bodyweight records from the <code>export.xml</code> inside your Apple Health export. The file is parsed locally; ARCUS doesn’t connect to HealthKit from the browser.</p></div><Apple className="data-panel-icon" size={24}/></div>
    <input ref={input} className="visually-hidden" type="file" accept=".xml,application/xml,text/xml" onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void inspect(file); event.currentTarget.value = ""; }}/>
    {!analysis ? <button className="action-button" type="button" disabled={busy} onClick={() => input.current?.click()}><Upload size={16}/> Choose Apple Health XML</button> : <div className="import-review"><div className="import-file-line"><strong>{fileName}</strong><span>Apple Health export · local preview</span></div><div className="import-summary"><div><strong>{analysis.workouts.length}</strong><span>WORKOUTS</span></div><div><strong>{analysis.metrics.length}</strong><span>BODYWEIGHT ENTRIES</span></div><div><strong>{analysis.skippedRows}</strong><span>SKIPPED</span></div></div><p className="data-caption">Workout records import as dated sessions. Apple Health doesn’t include ARCUS exercise-by-exercise sets in this export format.</p><div className="data-actions"><button className="outline-button" type="button" onClick={() => { setAnalysis(null); setMessage(""); }}>Cancel</button><button className="action-button" type="button" disabled={busy} onClick={() => void confirmImport()}>{busy ? "Saving locally…" : <><Check size={16}/> Import health data</>}</button></div></div>}
    {message && <p className="data-message" role="status">{message}</p>}
  </section>;
}

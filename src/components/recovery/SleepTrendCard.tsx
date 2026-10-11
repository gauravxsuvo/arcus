"use client";

import { useEffect, useState } from "react";
import { BarChart3 } from "lucide-react";
import type { SleepLogView } from "./ReadinessWidget";
import { formatSleepDuration } from "./ReadinessWidget";
import { localDateKey } from "@/features/recovery/readiness-engine";
import styles from "./recovery.module.css";

type RecoveryResponse = { today: SleepLogView | null; logs: SleepLogView[] };

export function SleepTrendCard({ initialLogs, standalone = false }: { initialLogs?: SleepLogView[]; standalone?: boolean }) {
  const [logs, setLogs] = useState<SleepLogView[]>(initialLogs ?? []);
  const [loaded, setLoaded] = useState(initialLogs !== undefined);
  const [signedOut, setSignedOut] = useState(false);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => { if (initialLogs !== undefined) setLogs(initialLogs); }, [initialLogs]);
  useEffect(() => {
    if (initialLogs !== undefined) return;
    let cancelled = false;
    void fetch(`/api/recovery/sleep?date=${localDateKey(new Date())}`, { credentials: "include", cache: "no-store" })
      .then(async response => {
        if (response.status === 401) { if (!cancelled) setSignedOut(true); return null; }
        if (!response.ok) throw new Error("Could not load sleep history.");
        return await response.json() as RecoveryResponse;
      })
      .then(data => { if (data && !cancelled) setLogs(data.logs); })
      .catch(() => { if (!cancelled) setLoadError(true); })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [initialLogs]);

  const average = logs.length ? logs.reduce((sum, item) => sum + item.durationMinutes, 0) / logs.length : 0;
  const readinessAverage = logs.length ? Math.round(logs.reduce((sum, item) => sum + item.readinessScore, 0) / logs.length) : 0;
  const chartDays = Array.from({ length: 7 }, (_, index) => {
    const day = new Date();
    day.setDate(day.getDate() - (6 - index));
    const date = localDateKey(day);
    const log = logs.find(item => item.date === date) ?? null;
    return { date, log, label: new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(day) };
  });

  return <section className={styles.card} aria-label="Seven-day sleep and recovery trend">
    <div className={styles.trendHead}>
      <div><p className={styles.kicker}>SLEEP & RECOVERY</p><h2 className={styles.title}>Last 7 nights</h2></div>
      {logs.length > 0 && <p className={styles.trendAverage}>Weekly avg: {(average / 60).toFixed(1)} hrs/night<br/>{readinessAverage}% avg readiness</p>}
    </div>
    {!loaded ? <div className={styles.empty} role="status">Loading your sleep history…</div> : signedOut ? <div className={styles.empty}><span>Sign in to view your sleep history.</span></div> : loadError ? <div className={styles.empty} role="alert">Sleep history could not load. Try again later.</div> : logs.length === 0 ? <div className={styles.empty}><span><BarChart3 size={20}/></span><span>Your sleep trend will appear after your first check-in.</span></div> : <div className={styles.chart}>
      <span className={styles.target} style={{ bottom: "80%" }} aria-hidden="true"/>
      {chartDays.map(day => {
        const minutes = day.log?.durationMinutes ?? 0;
        return <div key={day.date} className={styles.day} title={day.log ? `${day.date}: ${formatSleepDuration(minutes)} sleep, ${day.log.readinessScore}% readiness` : `${day.date}: no sleep entry`}>
          <span className={styles.hours}>{day.log ? `${(minutes / 60).toFixed(1)}h` : "—"}</span>
          <span className={styles.barArea}><span className={styles.bar} style={{ height: `${Math.max(minutes ? 4 : 0, Math.min(100, minutes / 600 * 100))}%`, opacity: day.log ? 1 : .15 }}/></span>
          <span>{day.label}</span>
        </div>;
      })}
      <span className={styles.targetLabel} aria-hidden="true">8h target</span>
    </div>}
    {standalone && logs.length > 0 && <p className={styles.subtle}>Bars show sleep time; the dashed line marks your 8-hour target.</p>}
  </section>;
}

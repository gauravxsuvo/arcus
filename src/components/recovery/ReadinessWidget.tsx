import styles from "./recovery.module.css";

export type SleepLogView = {
  id: string;
  date: string;
  bedtime: string;
  wakeTime: string;
  durationMinutes: number;
  qualityRating: 1 | 2 | 3;
  readinessScore: number;
  tags: string[];
  notes: string;
};

const STATUS = {
  optimal: { label: "OPTIMAL", color: "#34d399" },
  moderate: { label: "MODERATE", color: "#60a5fa" },
  low: { label: "LOW RECOVERY", color: "#fb7185" },
} as const;

export function formatSleepDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return `${hours}h ${String(remainder).padStart(2, "0")}m`;
}

export function ReadinessWidget({ log, recommendation }: { log: SleepLogView | null; recommendation?: string }) {
  if (!log) return <section className={styles.card} aria-label="Daily readiness">
    <p className={styles.kicker}>DAILY READINESS</p><h2 className={styles.title}>Start with a check-in.</h2>
    <p className={styles.subtle}>Log last night’s sleep to see your personal recovery score.</p>
  </section>;
  const status = log.readinessScore >= 80 ? STATUS.optimal : log.readinessScore >= 60 ? STATUS.moderate : STATUS.low;
  const circumference = 2 * Math.PI * 43;
  return <section className={styles.card} aria-label={`Readiness ${log.readinessScore} percent, ${status.label.toLowerCase()}`} style={{ "--gauge-color": status.color } as React.CSSProperties}>
    <div className={styles.gaugeRow}>
      <svg className={styles.gauge} viewBox="0 0 100 100" role="img" aria-label={`${log.readinessScore}% readiness`}>
        <circle className={styles.track} cx="50" cy="50" r="43"/>
        <circle className={styles.progress} cx="50" cy="50" r="43" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - log.readinessScore / 100)}/>
        <text className={styles.gaugeText} x="50" y="50">{log.readinessScore}%</text>
      </svg>
      <div>
        <p className={styles.status}><span className={styles.dot}/>{status.label}</p>
        <h2 className={styles.title}>READINESS</h2>
        <p className={styles.subtle}>{formatSleepDuration(log.durationMinutes)} sleep</p>
        <p className={styles.subtle}>{recommendation ?? "Your score combines sleep duration and how rested you felt."} A training estimate, not medical advice.</p>
      </div>
    </div>
  </section>;
}

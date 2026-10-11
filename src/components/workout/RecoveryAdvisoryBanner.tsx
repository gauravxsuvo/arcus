"use client";

import { useEffect, useState } from "react";
import { Lightbulb, X } from "lucide-react";
import { formatSleepDuration, type SleepLogView } from "@/components/recovery/ReadinessWidget";
import styles from "@/components/recovery/recovery.module.css";
import { localDateKey } from "@/features/recovery/readiness-engine";

export function RecoveryAdvisoryBanner() {
  const [log, setLog] = useState<SleepLogView | null>(null);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const today = localDateKey(new Date());
    void fetch(`/api/recovery/sleep?date=${today}`, { credentials: "include", cache: "no-store" })
      .then(async response => response.ok ? await response.json() as { today: SleepLogView | null } : null)
      .then(result => { if (!cancelled) setLog(result?.today ?? null); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);
  if (!log || dismissed || (log.readinessScore >= 65 && log.durationMinutes >= 360)) return null;
  return <aside className={styles.advisory} role="note"><Lightbulb className={styles.advisoryIcon} size={19}/><div><p><strong>Recovery alert:</strong> {formatSleepDuration(log.durationMinutes)} sleep recorded ({log.readinessScore}% readiness). Consider adjusting today’s intensity to your energy and how you feel.</p><small>This is general training context, not medical advice.</small></div><button className={`${styles.iconButton} ${styles.dismiss}`} type="button" aria-label="Dismiss recovery alert" onClick={() => setDismissed(true)}><X size={16}/></button></aside>;
}

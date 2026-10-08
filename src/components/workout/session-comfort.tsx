"use client";

import { Smartphone } from "lucide-react";
import type { useSessionComfort } from "./use-session-comfort";
import styles from "./session-comfort.module.css";

export function SessionComfort({ comfort }: { comfort: ReturnType<typeof useSessionComfort> }) {
  const wakeLabel = !comfort.supported.wake ? "Unavailable in this browser" : !comfort.preferences.keepAwake ? "While you’re on this screen" : ({ off: "Waiting for your session", requesting: "Turning on…", active: "Screen stays on", waiting: "Resumes when you return", unavailable: "Browser declined; toggle to retry" })[comfort.wakeStatus];
  return <details className={styles.panel}><summary><span><Smartphone size={16}/> Workout preferences</span><small>{comfort.wakeStatus === "active" ? "Screen awake" : "Make logging easier"}</small></summary><div className={styles.controls}>
    <label><span><strong>Auto-fill next set</strong><small>Copy load and reps to blank working sets.</small></span><input type="checkbox" checked={comfort.preferences.autoFill} onChange={event => comfort.update("autoFill", event.target.checked)}/></label>
    <label><span><strong>Keep screen awake</strong><small role="status">{wakeLabel}</small></span><input type="checkbox" checked={comfort.preferences.keepAwake} disabled={!comfort.ready || !comfort.supported.wake} onChange={event => comfort.update("keepAwake", event.target.checked)}/></label>
    <label><span><strong>Haptic feedback</strong><small>{comfort.supported.haptics ? "A short vibration for sets and rest." : "Vibration isn’t available in this browser."}</small></span><input type="checkbox" checked={comfort.preferences.haptics && comfort.supported.haptics} disabled={!comfort.ready || !comfort.supported.haptics} onChange={event => comfort.update("haptics", event.target.checked)}/></label>
  </div><p>Planned or edited sets keep their values. Effort is entered separately.</p></details>;
}

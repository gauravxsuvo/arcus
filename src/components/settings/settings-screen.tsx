"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bell, Check, ChevronRight, Database, Dumbbell, ShieldCheck } from "lucide-react";
import { useProfile } from "@/components/shared/user-profile-provider";
import { readTimerAudioEnabled, writeTimerAudioEnabled } from "@/lib/gym-audio";
import { readLockScreenCompanionEnabled, writeLockScreenCompanionEnabled } from "@/lib/lockscreen-companion";
import styles from "./settings-screen.module.css";

type Notice = { kind: "success" | "error"; text: string } | null;

export function SettingsScreen() {
  const { user, preferences, ready, setPreferences } = useProfile();
  const [notice, setNotice] = useState<Notice>(null);
  const [saving, setSaving] = useState(false);
  const [restDraft, setRestDraft] = useState(String(preferences.defaultRestTimer));
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [lockScreenEnabled, setLockScreenEnabled] = useState(true);
  const [recapAlerts, setRecapAlerts] = useState(false);
  const [notificationAvailable, setNotificationAvailable] = useState(true);

  useEffect(() => {
    setRestDraft(String(preferences.defaultRestTimer));
  }, [preferences.defaultRestTimer]);

  useEffect(() => {
    setAudioEnabled(readTimerAudioEnabled());
    setLockScreenEnabled(readLockScreenCompanionEnabled());
    const available = "Notification" in window;
    setNotificationAvailable(available);
    setRecapAlerts(available && localStorage.getItem("arcus-recap-alerts") === "enabled" && Notification.permission === "granted");
  }, []);

  async function updatePreferences(next: typeof preferences) {
    setSaving(true);
    setNotice(null);
    try {
      await setPreferences(next);
      setNotice({ kind: "success", text: "Your preferences are saved." });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not save your preferences." });
    } finally {
      setSaving(false);
    }
  }

  async function toggleRecapAlerts() {
    setNotice(null);
    if (recapAlerts) {
      localStorage.setItem("arcus-recap-alerts", "disabled");
      setRecapAlerts(false);
      setNotice({ kind: "success", text: "Weekly recap alerts are off. Your recaps remain available in the app." });
      return;
    }
    if (!("Notification" in window)) {
      setNotificationAvailable(false);
      setNotice({ kind: "error", text: "This browser does not support notifications. Your recaps remain available in the app." });
      return;
    }
    try {
      const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      const enabled = permission === "granted";
      localStorage.setItem("arcus-recap-alerts", enabled ? "enabled" : "disabled");
      setRecapAlerts(enabled);
      setNotice(enabled
        ? { kind: "success", text: "Weekly recap alerts are on. ARCUS will notify you when a recap is ready after you return to the app." }
        : { kind: "error", text: "Notification permission was not granted. You can still view recaps in the app." });
    } catch {
      setNotice({ kind: "error", text: "Could not update notification permission. Your recaps remain available in the app." });
    }
  }

  function toggleAudio() {
    const next = !audioEnabled;
    writeTimerAudioEnabled(next);
    setAudioEnabled(next);
    setNotice({ kind: "success", text: `Rest timer audio is ${next ? "on" : "muted"}.` });
  }

  function toggleLockScreenCompanion() {
    const next = !lockScreenEnabled;
    writeLockScreenCompanionEnabled(next);
    setLockScreenEnabled(next);
    setNotice({ kind: "success", text: `Lock Screen Companion is ${next ? "on" : "off"}. Availability depends on your browser and device.` });
  }

  const syncLabel = !user ? "Device profile" : user.syncStatus === "synced" ? "Synced to your account" : user.syncStatus === "error" ? "Sync needs attention" : "Saved on this device · sync pending";

  return <main className={`social-shell ${styles.shell}`}>
    <header className={styles.header}>
      <Link href="/profile" className={styles.back}><ArrowLeft size={17} /> Profile</Link>
      <p className="social-kicker"><span className="social-live-dot" /> YOUR TRAINING SPACE</p>
      <h1>Settings</h1>
      <p className={styles.intro}>Make ARCUS work the way you train.</p>
    </header>

    {!ready ? <div className={`feature-panel ${styles.loading}`} aria-label="Loading settings"><span /></div> : <>
      <section className={`feature-panel ${styles.group}`} aria-labelledby="account-title">
        <div className={styles.groupTitle}><span className={styles.icon}><ShieldCheck size={19} /></span><div><h2 id="account-title">Account</h2><p>Profile and account protection</p></div></div>
        <div className={styles.rows}>
          <Link className={`${styles.row} ${!user ? styles.signedOutRow : ""}`} href={user ? "/profile/edit" : "/login?next=%2Fsettings"}><span><strong>{user ? user.name || `@${user.username}` : "Sign in to ARCUS"}</strong><small>{user ? user.email : "Sync your training across devices"}</small></span><ChevronRight size={18} /></Link>
          <Link className={styles.row} href="/settings/security"><span><strong>Security & privacy</strong><small>Passkeys and two-factor authentication</small></span><ChevronRight size={18} /></Link>
          <div className={styles.sync}><span className={user?.syncStatus === "error" ? styles.syncError : styles.syncDot} />{syncLabel}</div>
        </div>
      </section>

      <section className={`feature-panel ${styles.group}`} aria-labelledby="workout-title">
        <div className={styles.groupTitle}><span className={styles.icon}><Dumbbell size={19} /></span><div><h2 id="workout-title">Workout preferences</h2><p>Defaults used in your training log</p></div></div>
        <div className={styles.rows}>
          <label className={styles.row} htmlFor="settings-units"><span><strong>Weight units</strong><small>Choose how weights are displayed</small></span><select id="settings-units" value={preferences.units} disabled={saving} onChange={event => void updatePreferences({ ...preferences, units: event.target.value as typeof preferences.units })}><option value="metric">Kilograms</option><option value="imperial">Pounds</option></select></label>
          <label className={styles.row} htmlFor="settings-rest"><span><strong>Default rest timer</strong><small>Used for exercises without a custom rest time</small></span><span className={styles.restInput}><input id="settings-rest" type="number" inputMode="numeric" min={0} max={1800} step={15} value={restDraft} disabled={saving} onChange={event => setRestDraft(event.target.value)} onBlur={() => { const parsed = Number(restDraft); const value = Number.isFinite(parsed) ? Math.min(1800, Math.max(0, Math.round(parsed))) : preferences.defaultRestTimer; setRestDraft(String(value)); if (value !== preferences.defaultRestTimer) void updatePreferences({ ...preferences, defaultRestTimer: value }); }} /><small>sec</small></span></label>
          <div className={styles.row}><span><strong>Lock Screen Companion</strong><small>Show your workout timer in supported lock screen media controls</small></span><button type="button" className={styles.switch} role="switch" aria-checked={lockScreenEnabled} aria-label="Lock Screen Companion (Show timer on phone lock screen)" onClick={toggleLockScreenCompanion}><span /></button></div>
        </div>
      </section>

      <section className={`feature-panel ${styles.group}`} aria-labelledby="alerts-title">
        <div className={styles.groupTitle}><span className={styles.icon}><Bell size={19} /></span><div><h2 id="alerts-title">Notifications & sound</h2><p>Choose the feedback ARCUS can use</p></div></div>
        <div className={styles.rows}>
          <div className={styles.row}><span><strong>Weekly recap alerts</strong><small>{notificationAvailable ? "A notification when a completed weekly recap is ready" : "Notifications are unavailable in this browser"}</small></span><button type="button" className={styles.switch} role="switch" aria-checked={recapAlerts} aria-label="Weekly recap alerts" disabled={!notificationAvailable} onClick={() => void toggleRecapAlerts()}><span /></button></div>
          <div className={styles.row}><span><strong>Rest timer sound</strong><small>Play a chime when your rest timer ends</small></span><button type="button" className={styles.switch} role="switch" aria-checked={audioEnabled} aria-label="Rest timer sound" onClick={toggleAudio}><span /></button></div>
        </div>
      </section>

      <section className={`feature-panel ${styles.group}`} aria-labelledby="data-title">
        <div className={styles.groupTitle}><span className={styles.icon}><Database size={19} /></span><div><h2 id="data-title">Data & privacy</h2><p>Your training data stays in your control</p></div></div>
        <div className={styles.rows}><Link className={styles.row} href="/profile/data"><span><strong>Export, import, or restore data</strong><small>Manage workout backups and account data</small></span><ChevronRight size={18} /></Link><Link className={styles.row} href="/privacy"><span><strong>Privacy policy</strong><small>How ARCUS handles your information</small></span><ChevronRight size={18} /></Link></div>
      </section>
    </>}
    {notice && <p className={notice.kind === "error" ? styles.error : styles.notice} role={notice.kind === "error" ? "alert" : "status"}>{notice.kind === "success" && <Check size={16} />}{notice.text}</p>}
    <footer className={styles.footer}><Link href="/terms">Terms of service</Link><span>·</span><Link href="/privacy">Privacy</Link><Link href="/profile/data">Data tools</Link></footer>
  </main>;
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { createScreenWakeLock, type WakeStatus } from "@/features/device/screen-wake-lock";

type Preferences = { autoFill: boolean; keepAwake: boolean; haptics: boolean };
const defaults: Preferences = { autoFill: true, keepAwake: false, haptics: true };
const key = "arcus-session-comfort-v1";

export function useSessionComfort(active: boolean) {
  const [preferences, setPreferences] = useState(defaults);
  const [ready, setReady] = useState(false);
  const [supported, setSupported] = useState({ wake: false, haptics: false });
  const [wakeStatus, setWakeStatus] = useState<WakeStatus>("off");
  useEffect(() => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      if (value && typeof value === "object") setPreferences({ autoFill: typeof value.autoFill === "boolean" ? value.autoFill : defaults.autoFill, keepAwake: value.keepAwake === true, haptics: typeof value.haptics === "boolean" ? value.haptics : defaults.haptics });
    } catch { /* Restricted storage keeps the session defaults. */ }
    setSupported({ wake: window.isSecureContext && "wakeLock" in navigator, haptics: typeof navigator.vibrate === "function" });
    setReady(true);
  }, []);
  useEffect(() => {
    if (!active || !ready || !preferences.keepAwake || !supported.wake) { setWakeStatus("off"); return; }
    const controller = createScreenWakeLock({ request: () => navigator.wakeLock.request("screen"), visible: () => document.visibilityState === "visible", onStatus: setWakeStatus });
    const refresh = () => void controller.refresh();
    refresh();
    document.addEventListener("visibilitychange", refresh);
    return () => { document.removeEventListener("visibilitychange", refresh); controller.dispose(); };
  }, [active, ready, preferences.keepAwake, supported.wake]);
  const update = (field: keyof Preferences, value: boolean) => {
    const next = { ...preferences, [field]: value };
    setPreferences(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Session controls still work without persistence. */ }
  };
  const vibrate = useCallback((pattern: number | number[]) => {
    if (preferences.haptics) try { navigator.vibrate?.(pattern); } catch { /* Unsupported feedback must never block a save. */ }
  }, [preferences.haptics]);
  return { preferences, ready, supported, wakeStatus, update, vibrate };
}

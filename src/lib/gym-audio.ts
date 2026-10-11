"use client";

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const browserWindow = window as Window & { webkitAudioContext?: typeof AudioContext };
  const AudioContextConstructor = window.AudioContext ?? browserWindow.webkitAudioContext;
  if (!AudioContextConstructor) return null;
  audioContext ??= new AudioContextConstructor();
  return audioContext;
}

/** Call this from a user gesture so mobile browsers permit later timer audio. */
export async function unlockGymAudio(): Promise<void> {
  try {
    const context = getAudioContext();
    if (context?.state === "suspended") await context.resume();
  } catch {
    // Some browsers or device settings can deny audio; workout logging still works.
  }
}

export function playTimerCompletionSound(): void {
  try {
    const context = getAudioContext();
    if (!context) return;
    if (context.state === "suspended") void context.resume().catch(() => undefined);
    const startAt = context.currentTime + 0.02;
    const tones = [
      { frequency: 880, delay: 0, duration: 0.4 },
      { frequency: 1760, delay: 0.15, duration: 0.6 },
    ];
    for (const tone of tones) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = startAt + tone.delay;
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(tone.frequency, start);
      gain.gain.setValueAtTime(0.3, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + tone.duration);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + tone.duration + 0.02);
    }
  } catch {
    // Audio is an enhancement and must never interrupt a workout.
  }
}

export function readTimerAudioEnabled(): boolean {
  try {
    const stored = window.localStorage.getItem("arcus_timer_audio_enabled");
    return stored === null ? true : stored === "true";
  } catch {
    return true;
  }
}

export function writeTimerAudioEnabled(enabled: boolean): void {
  try { window.localStorage.setItem("arcus_timer_audio_enabled", String(enabled)); }
  catch { /* Settings can remain temporary when storage is unavailable. */ }
}

export function triggerTimerCompletionHaptic(): void {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate([200, 100, 200, 100, 400]);
    }
  } catch {
    // Vibration is unavailable on iOS and can be denied by browser policy.
  }
}

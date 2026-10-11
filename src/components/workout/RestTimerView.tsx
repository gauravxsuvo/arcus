"use client";

import { useEffect, useState } from "react";
import { Clock3, Volume2, VolumeX, X } from "lucide-react";
import { NumericInput } from "@/components/shared/numeric-input";
import { playTimerCompletionSound, triggerTimerCompletionHaptic } from "@/lib/gym-audio";
import styles from "@/app/workout/workout.module.css";

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

type Props = {
  endTime: number;
  audioEnabled: boolean;
  onAudioToggle: () => void;
  onChangeEndTime: (endTime: number) => void;
  onDismiss: () => void;
  onComplete: () => void;
};

export function RestTimerView({ endTime, audioEnabled, onAudioToggle, onChangeEndTime, onDismiss, onComplete }: Props) {
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.ceil((endTime - Date.now()) / 1000)));

  useEffect(() => {
    let completed = false;
    const update = () => {
      const left = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0 && !completed) {
        completed = true;
        if (audioEnabled) playTimerCompletionSound();
        triggerTimerCompletionHaptic();
        onComplete();
      }
    };
    update();
    const timer = window.setInterval(update, 250);
    return () => window.clearInterval(timer);
  }, [endTime, audioEnabled, onComplete]);

  const changeRemaining = (next: number) => onChangeEndTime(Date.now() + Math.max(0, Math.min(1800, next)) * 1000);

  return <aside className={styles.restTimer} aria-label="Rest timer">
    <div className={styles.restTime}><Clock3 size={19}/><div><span>Rest timer</span><strong>{formatTime(remaining)}</strong></div></div>
    <label className={styles.restEdit}>Seconds<NumericInput aria-label="Edit remaining rest time" min="0" max="1800" value={remaining} onChange={event=>changeRemaining(Number(event.target.value))}/></label>
    <div className={styles.restControls}>
      <button type="button" onClick={() => changeRemaining(remaining - 15)} aria-label="Subtract 15 seconds">−15</button>
      <button type="button" onClick={() => changeRemaining(remaining + 15)} aria-label="Add 15 seconds">+15</button>
      <button type="button" className={styles.audioToggle} aria-label={audioEnabled ? "Mute rest timer chime" : "Enable rest timer chime"} aria-pressed={audioEnabled} onClick={onAudioToggle}><span>{audioEnabled ? <Volume2 size={16}/> : <VolumeX size={16}/>}</span>{audioEnabled ? "Audio on" : "Muted"}</button>
      <button type="button" onClick={onDismiss} aria-label="Skip rest timer"><X size={18}/></button>
    </div>
  </aside>;
}

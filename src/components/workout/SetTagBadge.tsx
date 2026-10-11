"use client";

import { useId, useState } from "react";
import type { SetType } from "@/features/workouts/model";
import styles from "./set-tag-badge.module.css";

type TagChoice = { value: SetType; short: string; label: string };
const choices: TagChoice[] = [
  { value: "working", short: "1", label: "Normal" },
  { value: "warmup", short: "W", label: "Warmup" },
  { value: "drop", short: "D", label: "Drop-set" },
  { value: "failure", short: "F", label: "Failure" },
];

export function SetTagBadge({ setType = "working", setNumber, onChange }: { setType?: SetType; setNumber: number; onChange: (type: SetType) => void }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const active = choices.find((choice) => choice.value === setType) ?? choices[0];
  const label = active.value === "working" ? String(setNumber) : active.short;
  return <div className={styles.root}>
    <button type="button" className={`${styles.trigger} ${styles[active.value]}`} aria-label={`Set ${setNumber}: ${active.label}. Choose set type.`} aria-expanded={open} aria-controls={menuId} onClick={() => setOpen(value => !value)}>{label}</button>
    {open && <div className={styles.menu} id={menuId} role="group" aria-label={`Set ${setNumber} type`}>
      {choices.map((choice) => <button type="button" key={choice.value} className={`${styles.option} ${styles[choice.value]} ${active.value === choice.value ? styles.selected : ""}`} aria-pressed={active.value === choice.value} onClick={() => { onChange(choice.value); setOpen(false); }}><span>{choice.short === "1" ? setNumber : choice.short}</span>{choice.label}</button>)}
    </div>}
  </div>;
}

"use client";

import { useState } from "react";
import { NumericInput } from "./numeric-input";
import { useProfile } from "./user-profile-provider";
import { calculatePlates, toDisplayWeight, weightUnit } from "@/features/training/logic";
import styles from "./plate-calculator.module.css";

export default function PlateCalculator({ initialWeightKg, embedded = false, exerciseName }: { initialWeightKg?: number | null; embedded?: boolean; exerciseName?: string }) {
  const { preferences } = useProfile();
  const units = preferences.units;
  const unit = weightUnit(units);
  const [target, setTarget] = useState(initialWeightKg != null ? Number(toDisplayWeight(initialWeightKg, units).toFixed(2)) : units === "metric" ? 100 : 225);
  const [bar, setBar] = useState(units === "metric" ? 20 : 45);
  const result = calculatePlates(target, bar, units);
  const counts = new Map<number, number>();
  for (const size of result.plates) counts.set(size, (counts.get(size) ?? 0) + 1);
  const plateWidth = Math.min(10, 130 / Math.max(1, result.plates.length));
  const maxPlate = units === "metric" ? 25 : 45;
  const content = <>
    {exerciseName && <p className={styles.exercise}>{exerciseName}</p>}
    <div className={styles.inputs}><label>Target · {unit}<NumericInput aria-label={`Target barbell weight in ${unit}`} min="0" max="2000" value={target} onChange={event => setTarget(Math.max(0, Math.min(2000, Number(event.target.value))))}/></label><label>Bar · {unit}<NumericInput aria-label={`Bar weight in ${unit}`} min="0" max="100" value={bar} onChange={event => setBar(Math.max(0, Math.min(100, Number(event.target.value))))}/></label></div>
    <svg className={styles.diagram} viewBox="0 0 432 140" role="img" aria-label={result.plates.length ? `${result.plates.join(" plus ")} ${unit} on each side of a ${bar} ${unit} bar` : `Empty ${bar} ${unit} bar`}>
      <rect x="20" y="66" width="392" height="8" rx="4" fill="var(--feature-muted)"/>
      <rect x="160" y="60" width="112" height="20" rx="4" fill="var(--feature-border)"/>
      {[-1, 1].flatMap(side => result.plates.map((plate, index) => { const height = 28 + plate / maxPlate * 76; return <rect key={`${side}-${index}`} x={side === 1 ? 276 + index * plateWidth : 156 - (index + 1) * plateWidth} y={70 - height / 2} width={Math.max(1, plateWidth - 1)} height={height} rx="2" fill={plate >= maxPlate * .7 ? "#5b97ff" : plate >= maxPlate * .3 ? "#c49c57" : "#679b7d"}/>; }))}
    </svg>
    <p className={styles.caption}>Load on <strong>each side</strong></p>
    <ul className={styles.plates} aria-label="Plates per side">{[...counts].map(([size, count]) => <li key={size}><strong>{count} × {size}</strong><span>{unit}</span></li>)}{!counts.size && <li>Empty bar</li>}</ul>
    <div className={styles.total}><span>{result.remainder > .001 ? "Achievable total" : "Total load"}</span><strong>{result.achieved.toLocaleString(undefined, { maximumFractionDigits: 2 })} {unit}</strong></div>
    {target < bar ? <p className={styles.note} role="status">Target is below the selected bar weight.</p> : result.remainder > .001 ? <p className={styles.note} role="status">{result.remainder.toLocaleString(undefined, { maximumFractionDigits: 2 })} {unit} remains. Smaller plates are needed to reach your target.</p> : <p className={styles.note}>Assumes standard plates and an equal load on both sides.</p>}
  </>;
  return embedded ? <section className={styles.embedded} aria-label="Barbell plate calculator">{content}</section> : <details className={`feature-panel ${styles.panel}`}><summary>Barbell plate calculator</summary>{content}</details>;
}

"use client";

import { useState } from "react";
import { NumericInput } from "./numeric-input";
import { useProfile } from "./user-profile-provider";
import { toDisplayWeight, weightUnit } from "@/features/training/logic";
import { calculatePlates } from "@/lib/plate-calculator";
import styles from "./plate-calculator.module.css";

export default function PlateCalculator({ initialWeightKg, embedded = false, exerciseName }: { initialWeightKg?: number | null; embedded?: boolean; exerciseName?: string }) {
  const { preferences } = useProfile();
  const units = preferences.units;
  const unit = weightUnit(units);
  const [target, setTarget] = useState(initialWeightKg != null ? Number(toDisplayWeight(initialWeightKg, units).toFixed(2)) : units === "metric" ? 100 : 225);
  const [bar, setBar] = useState(units === "metric" ? 20 : 45);
  const plateUnit = units === "metric" ? "kg" : "lbs";
  const result = calculatePlates(target, bar, plateUnit);
  const counts = new Map<number, number>();
  for (const plate of result.platesPerSide) counts.set(plate.weight, plate.count);
  const loadedPlates = result.platesPerSide.flatMap(({ weight, count }) => Array.from({ length: count }, () => weight));
  const plateWidth = Math.min(10, 130 / Math.max(1, loadedPlates.length));
  const maxPlate = units === "metric" ? 25 : 45;
  const content = <>
    {exerciseName && <p className={styles.exercise}>{exerciseName}</p>}
    <div className={styles.inputs}><label>Target · {unit}<NumericInput aria-label={`Target barbell weight in ${unit}`} min="0" max="2000" value={target} onChange={event => setTarget(Math.max(0, Math.min(2000, Number(event.target.value))))}/></label><div className={styles.barSelector}><span>Bar · {unit}</span><div className={styles.barChoices}><button type="button" aria-pressed={bar === (units === "metric" ? 20 : 45)} onClick={() => setBar(units === "metric" ? 20 : 45)}>Standard {units === "metric" ? "20 kg" : "45 lb"}</button><button type="button" aria-pressed={bar === (units === "metric" ? 15 : 33)} onClick={() => setBar(units === "metric" ? 15 : 33)}>Technique {units === "metric" ? "15 kg" : "33 lb"}</button></div></div></div>
    <div className={styles.quickAdjust} aria-label="Adjust target weight"><button type="button" onClick={() => setTarget(value => Math.max(0, value - 2.5))}>− 2.5 {unit}</button><button type="button" onClick={() => setTarget(value => Math.min(2000, value + 2.5))}>+ 2.5 {unit}</button></div>
    <svg className={styles.diagram} viewBox="0 0 432 140" role="img" aria-label={loadedPlates.length ? `${loadedPlates.join(" plus ")} ${unit} on each side of a ${bar} ${unit} bar` : `Empty ${bar} ${unit} bar`}>
      <rect x="20" y="66" width="392" height="8" rx="4" fill="var(--feature-muted)"/>
      <rect x="160" y="60" width="112" height="20" rx="4" fill="var(--feature-border)"/>
      {[-1, 1].flatMap(side => loadedPlates.map((plate, index) => { const height = 28 + plate / maxPlate * 76; return <rect key={`${side}-${index}`} x={side === 1 ? 276 + index * plateWidth : 156 - (index + 1) * plateWidth} y={70 - height / 2} width={Math.max(1, plateWidth - 1)} height={height} rx="2" fill={plate >= maxPlate * .7 ? "#5b97ff" : plate >= maxPlate * .3 ? "#c49c57" : "#679b7d"}/>; }))}
    </svg>
    <p className={styles.caption}>Load on <strong>each side</strong></p>
    <ul className={styles.plates} aria-label="Plates per side">{[...counts].map(([size, count]) => <li key={size}><strong>{count} × {size}</strong><span>{unit}</span></li>)}{!counts.size && <li>Empty bar</li>}</ul>
    <div className={styles.total}><span>{result.isExact ? "Achievable total" : "Closest load below target"}</span><strong>{result.achievableWeight.toLocaleString(undefined, { maximumFractionDigits: 2 })} {unit}</strong></div>
    {!result.isExact ? <p className={styles.note} role="status">{target < bar ? "The target is below the selected bar weight." : "The available plates can’t match your target exactly. This load stays at or below it."}</p> : <p className={styles.note}>Assumes standard plates and an equal load on both sides.</p>}
  </>;
  return embedded ? <section className={styles.embedded} aria-label="Barbell plate calculator">{content}</section> : <details className={`feature-panel ${styles.panel}`}><summary>Barbell plate calculator</summary>{content}</details>;
}

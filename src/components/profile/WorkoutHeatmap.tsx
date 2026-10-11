"use client";

import { useMemo, useState } from "react";
import styles from "./workout-heatmap.module.css";
import type { DayActivity } from "@/features/training/activity";
import type { Units } from "@/features/profile/model";
import { formatWeight } from "@/features/training/logic";

type Props = { activities: DayActivity[]; year: number; units: Units; compact?: boolean; loading?: boolean };

function dateLabel(date: string) {
  return new Intl.DateTimeFormat("en", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`));
}

export function WorkoutHeatmap({ activities, year, units, compact = false, loading = false }: Props) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const { cells, months, byDate } = useMemo(() => {
    const map = new Map(activities.map((activity) => [activity.date, activity]));
    const janFirst = new Date(Date.UTC(year, 0, 1));
    janFirst.setUTCDate(janFirst.getUTCDate() - ((janFirst.getUTCDay() + 6) % 7));
    const dates = Array.from({ length: 53 * 7 }, (_, index) => {
      const date = new Date(janFirst);
      date.setUTCDate(janFirst.getUTCDate() + index);
      return date.toISOString().slice(0, 10);
    });
    const monthStarts: { month: string; column: number }[] = [];
    dates.forEach((date, index) => {
      const parsed = new Date(`${date}T00:00:00Z`);
      if (parsed.getUTCFullYear() === year && parsed.getUTCDate() === 1) {
        const column = Math.floor(index / 7) + 1;
        if (!monthStarts.some((item) => item.column === column)) monthStarts.push({ month: new Intl.DateTimeFormat("en", { month: "short", timeZone: "UTC" }).format(parsed), column });
      }
    });
    return { cells: dates, months: monthStarts, byDate: map };
  }, [activities, year]);

  const selected = selectedDate ? byDate.get(selectedDate) : undefined;

  return <section className={`${styles.heatmap} ${compact ? styles.compact : ""}`} aria-label={`${year} workout activity`}>
    <div className={styles.heading}><div><h2>{compact ? "Consistency" : "Training consistency"}</h2><p>{year} · each square is one day</p></div>{!compact && <span className={styles.legend}>Less <i className={styles.level0}/><i className={styles.level1}/><i className={styles.level2}/><i className={styles.level3}/> More</span>}</div>
    {loading ? <div className={styles.skeleton} aria-label="Loading workout activity" role="status"/> : <div className={styles.scroller}>
      <div className={styles.calendar}>
        <div className={styles.months} aria-hidden="true">{months.map(({ month, column }) => <span key={`${month}-${column}`} style={{ gridColumnStart: column }}>{month}</span>)}</div>
        <div className={styles.grid} role="group" aria-label={`${year} workout days, select a day for details`}>
          {cells.map((date) => {
            const activity = byDate.get(date);
            const outsideYear = Number(date.slice(0, 4)) !== year;
            const level = !activity ? 0 : activity.isPersonalRecord ? 3 : activity.count >= 2 || activity.totalVolume >= 5000 ? 2 : 1;
            const details = activity ? `${activity.count} ${activity.count === 1 ? "workout" : "workouts"}${activity.titles.length ? `: ${activity.titles.join(", ")}` : ""}${activity.totalVolume > 0 ? ` · ${formatWeight(activity.totalVolume, units, 0)}` : ""}${activity.isPersonalRecord ? " · personal record" : ""}` : "Rest day";
            return <button key={date} type="button" disabled={outsideYear} className={styles.day} data-level={level} aria-label={`${dateLabel(date)} · ${details}`} aria-pressed={selectedDate === date} title={`${dateLabel(date)} · ${details}`} onClick={() => setSelectedDate((current) => current === date ? null : date)} />;
          })}
        </div>
      </div>
    </div>}
    {selectedDate && <p className={styles.tooltip} role="status"><strong>{dateLabel(selectedDate)}</strong><span>{selected ? `${selected.count} ${selected.count === 1 ? "workout" : "workouts"}${selected.titles.length ? ` · ${selected.titles.join(", ")}` : ""}${selected.totalVolume > 0 ? ` · ${formatWeight(selected.totalVolume, units, 0)}` : ""}${selected.isPersonalRecord ? " · Personal record" : ""}` : "No workout logged"}</span><button type="button" aria-label="Close activity detail" onClick={() => setSelectedDate(null)}>×</button></p>}
  </section>;
}

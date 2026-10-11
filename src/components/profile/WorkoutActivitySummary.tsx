"use client";

import { useEffect, useMemo, useState } from "react";
import { getUserWorkoutHistory } from "@/app/actions/activity-history";
import { buildWorkoutActivity, mergeLocalWorkoutActivity, type DayActivity } from "@/features/training/activity";
import type { Units } from "@/features/profile/model";
import type { WorkoutRecord } from "@/features/workouts/model";
import { StreakBadge } from "./StreakBadge";
import { WorkoutHeatmap } from "./WorkoutHeatmap";
import styles from "./workout-heatmap.module.css";

export function WorkoutActivitySummary({ userId, workouts, units, compact = false }: { userId?: string; workouts: WorkoutRecord[]; units: Units; compact?: boolean }) {
  const year = new Date().getUTCFullYear();
  const localActivities = useMemo(() => buildWorkoutActivity(workouts, year), [workouts, year]);
  const [activities, setActivities] = useState<DayActivity[]>(localActivities);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setActivities(localActivities);
  }, [localActivities]);

  useEffect(() => {
    if (!userId) { setLoaded(true); return; }
    let cancelled = false;
    void getUserWorkoutHistory(userId, year)
      .then((remoteActivities) => { if (!cancelled) setActivities(mergeLocalWorkoutActivity(remoteActivities, workouts, year)); })
      .catch(() => { /* The local-first workout log remains available offline or before account sync. */ })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [userId, year, workouts]);

  return <div className={`${styles.summary} ${compact ? styles.compactSummary : ""}`} aria-busy={!loaded}>
    <StreakBadge activities={activities} year={year} units={units}/>
    <WorkoutHeatmap activities={activities} year={year} units={units} compact={compact} loading={!loaded && localActivities.length === 0}/>
  </div>;
}

"use client";

import { useEffect } from "react";
import { getPendingWorkouts, saveWorkout } from "@/features/workouts/repository";
import { getPendingCustomExercises, getPendingPhysiqueEntries, getPendingPrograms, saveCustomExercise, savePhysiqueEntry, saveProgram } from "@/features/local-data/repository";
import { syncCompletedWorkout, syncCustomExercise, syncPhysiqueEntry, syncProgram } from "@/features/workouts/sync";

export function SyncManager() {
  useEffect(() => {
    let busy = false;
    const synchronize = async () => {
      if (busy || !navigator.onLine) return;
      busy = true;
      try {
        const customExercises = await getPendingCustomExercises();
        for (const exercise of customExercises) {
          try { await syncCustomExercise(exercise); }
          catch (error) { await saveCustomExercise({ ...exercise, syncStatus: "error" }); if (process.env.NODE_ENV === "development") console.info("Custom exercise sync will retry later", error); }
        }
        const programs = await getPendingPrograms();
        for (const program of programs) {
          try { await syncProgram(program); }
          catch (error) { await saveProgram({ ...program, syncStatus: "error" }); if (process.env.NODE_ENV === "development") console.info("Program sync will retry later", error); }
        }
        const physiqueEntries = await getPendingPhysiqueEntries();
        for (const entry of physiqueEntries) {
          try { await syncPhysiqueEntry(entry); }
          catch (error) { await savePhysiqueEntry({ ...entry, syncStatus: "error" }); if (process.env.NODE_ENV === "development") console.info("Physique sync will retry later", error); }
        }
        const pending = await getPendingWorkouts();
        for (const workout of pending) {
          try {
            await syncCompletedWorkout(workout);
          } catch (error) {
            await saveWorkout({ ...workout, syncStatus: "error" });
            if (process.env.NODE_ENV === "development") console.info("Workout sync will retry later", error);
          }
        }
      } catch (error) {
        if (process.env.NODE_ENV === "development") console.info("Workout outbox is unavailable", error);
      } finally { busy = false; }
    };
    void synchronize();
    window.addEventListener("online", synchronize);
    window.addEventListener("focus", synchronize);
    return () => {
      window.removeEventListener("online", synchronize);
      window.removeEventListener("focus", synchronize);
    };
  }, []);
  return null;
}

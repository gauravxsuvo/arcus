"use client";
import { createContext, useCallback, useContext, useState } from "react";
import type { WorkoutRecord } from "@/features/workouts/model";
import { saveWorkout } from "@/features/workouts/repository";
const Context=createContext<{workout:WorkoutRecord|null;setWorkout:React.Dispatch<React.SetStateAction<WorkoutRecord|null>>;persist:(workout:WorkoutRecord)=>Promise<void>}|null>(null);
export function WorkoutProvider({children}:{children:React.ReactNode}){const [workout,setWorkout]=useState<WorkoutRecord|null>(null);const persist=useCallback(async(next:WorkoutRecord)=>{await saveWorkout(next);setWorkout(next);},[]);return <Context.Provider value={{workout,setWorkout,persist}}>{children}</Context.Provider>;}
export function useWorkout(){const value=useContext(Context);if(!value)throw new Error("Workout provider missing.");return value;}

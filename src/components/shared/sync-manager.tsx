"use client";
import { useEffect } from "react";
import { getPendingWorkouts } from "@/features/workouts/repository";
import { syncCompletedWorkout } from "@/features/workouts/sync";
import { flushLibrary } from "@/features/local-data/sync";
import { flushProfile } from "@/features/profile/sync";
import { getLocalSession } from "@/features/local-data/repository";
export function SyncManager() {
  useEffect(()=>{
    let busy=false,lastRun=0,stopped=false;
    const synchronize=async()=>{
      if(stopped||busy||!navigator.onLine||Date.now()-lastRun<30000)return;
      busy=true;lastRun=Date.now();
      try{
        if(!await getLocalSession())return;
        await flushProfile();await new Promise(resolve=>setTimeout(resolve,1000));await flushLibrary();
        for(const workout of (await getPendingWorkouts()).slice(0,10)){
          if(stopped)break;await new Promise(resolve=>setTimeout(resolve,1100));
          try{await syncCompletedWorkout(workout);}catch{break;}
        }
      }catch{ /* The persisted outbox retries on reconnect, focus, or the next interval. */ }
      finally{busy=false;}
    };
    void synchronize();const timer=window.setInterval(()=>void synchronize(),60000);
    window.addEventListener("online",synchronize);window.addEventListener("focus",synchronize);
    return()=>{stopped=true;window.clearInterval(timer);window.removeEventListener("online",synchronize);window.removeEventListener("focus",synchronize);};
  },[]);
  return null;
}

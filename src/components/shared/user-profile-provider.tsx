"use client";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getDevicePreferences, getLocalSession, saveDevicePreferences, updateLocalUser, type LocalUser } from "@/features/local-data/repository";
import { DEFAULT_PREFERENCES, type ProfilePreferences, type UserProfile } from "@/features/profile/model";
import { flushProfile } from "@/features/profile/sync";

type ProfileContextValue = { user:LocalUser|null; preferences:ProfilePreferences; ready:boolean; refresh:()=>Promise<void>; save:(profile:UserProfile)=>Promise<void>; setPreferences:(prefs:ProfilePreferences)=>Promise<void> };
const ProfileContext = createContext<ProfileContextValue|null>(null);
export function UserProfileProvider({children}:{children:React.ReactNode}) {
  const [user,setUser] = useState<LocalUser|null>(null);
  const [preferences,setPrefs] = useState(DEFAULT_PREFERENCES);
  const [ready,setReady] = useState(false);
  const refresh = useCallback(async () => {
    const [account,device] = await Promise.all([getLocalSession(),getDevicePreferences()]);
    let theme:"dark"|"light"="dark";
    try{theme=localStorage.getItem("arcus-theme")==="light"?"light":"dark";}catch{ /* IndexedDB preferences still apply if localStorage is unavailable. */ }
    setUser(account); setPrefs({...DEFAULT_PREFERENCES,theme,...device,...account?.profile.preferences}); setReady(true);
  },[]);
  useEffect(() => { const load = () => void refresh().catch(() => setReady(true)); load(); window.addEventListener("arcus-profile-updated",load); window.addEventListener("focus",load); return () => {window.removeEventListener("arcus-profile-updated",load);window.removeEventListener("focus",load);}; },[refresh]);
  const save = async (profile:UserProfile) => {
    const current = await getLocalSession(); if (!current) throw new Error("Sign in to save profile changes.");
    await updateLocalUser({...current,profile,syncStatus:"pending",updatedAt:new Date().toISOString()}); await refresh(); void flushProfile().catch(() => undefined);
  };
  const setPreferences = async (prefs:ProfilePreferences) => { await saveDevicePreferences(prefs); const current = await getLocalSession(); if(current) await save({...current.profile,preferences:prefs}); else {setPrefs(prefs);} };
  return <ProfileContext.Provider value={{user,preferences,ready,refresh,save,setPreferences}}>{children}</ProfileContext.Provider>;
}
export function useProfile() { const value=useContext(ProfileContext); if(!value) throw new Error("Profile provider is missing."); return value; }

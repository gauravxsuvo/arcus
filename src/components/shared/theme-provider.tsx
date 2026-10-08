"use client";
import { createContext, useContext, useEffect } from "react";
import { Moon, Sun } from "lucide-react";
import { useProfile } from "./user-profile-provider";
const ThemeContext=createContext<{theme:"dark"|"light";toggle:()=>void}|null>(null);
export function ThemeProvider({children}:{children:React.ReactNode}) {
  const {preferences,setPreferences,ready}=useProfile();
  useEffect(() => { if(ready) { document.documentElement.dataset.theme=preferences.theme;try{localStorage.setItem("arcus-theme",preferences.theme);}catch{}const meta=document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');if(meta)meta.content=preferences.theme==="light"?"#fafafa":"#09090b"; } },[preferences.theme,ready]);
  const toggle=()=>void setPreferences({...preferences,theme:preferences.theme==="dark"?"light":"dark"});
  return <ThemeContext.Provider value={{theme:preferences.theme,toggle}}>{children}</ThemeContext.Provider>;
}
export function ThemeToggle() { const context=useContext(ThemeContext); return <button type="button" className="outline-button nav-theme-toggle" onClick={context?.toggle} aria-label="Switch color theme">{context?.theme==="light"?<Moon size={16}/>:<Sun size={16}/>} {context?.theme==="light"?"Dark theme":"Light theme"}</button>; }

"use client";
import { createContext, useContext, useEffect } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useProfile } from "./user-profile-provider";
import { THEME_COLORS } from "@/features/profile/theme";
import styles from "./theme-toggle.module.css";

const ThemeContext=createContext<{theme:"dark"|"light";toggle:()=>void}|null>(null);
export function ThemeProvider({children}:{children:React.ReactNode}) {
  const {preferences,setPreferences,ready}=useProfile();
  useEffect(() => {
    if (!ready) return;
    document.documentElement.dataset.theme = preferences.theme;
    try { localStorage.setItem("arcus-theme", preferences.theme); } catch {}
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (meta) meta.content = THEME_COLORS[preferences.theme];
  }, [preferences.theme, ready]);
  const toggle=()=>void setPreferences({...preferences,theme:preferences.theme==="dark"?"light":"dark"});
  return <ThemeContext.Provider value={{theme:preferences.theme,toggle}}>{children}</ThemeContext.Provider>;
}

export function ThemeToggle() {
  const context=useContext(ThemeContext);
  const reduceMotion=useReducedMotion();
  if (!context) return null;
  const isDark=context.theme==="dark";
  const spring = reduceMotion ? { duration: 0.01 } : { type: "spring" as const, stiffness: 420, damping: 22 };
  return <label className={styles.toggle} title={`Switch to ${isDark ? "light" : "dark"} theme`}>
    <input className={styles.checkbox} type="checkbox" role="switch" checked={isDark} onChange={context.toggle} aria-label={`Theme: switch to ${isDark ? "light" : "dark"} theme`} aria-checked={isDark}/>
    <motion.svg className={styles.icon} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" initial={false} animate={{ rotate: isDark ? -12 : 0 }} transition={spring}>
      <motion.g className={styles.glyph} initial={false} animate={{ opacity: isDark ? 0 : 1, scale: isDark ? 0.72 : 1 }} transition={spring}>
        <circle cx="12" cy="12" r="4"/>
        <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/>
      </motion.g>
      <motion.g className={styles.glyph} initial={false} animate={{ opacity: isDark ? 1 : 0, scale: isDark ? 1 : 0.72 }} transition={spring}>
        <path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6.5 6.5 0 0 0 8.268 8.268c.344-.215.825-.003.803.401"/>
      </motion.g>
    </motion.svg>
  </label>;
}

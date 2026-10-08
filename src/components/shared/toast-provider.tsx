"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CheckCircle2, CircleAlert, X } from "lucide-react";
import styles from "./mobile-feedback.module.css";

type Kind = "success" | "error";
type Action = { label: string; onClick: () => void };
const ToastContext = createContext<{ showToast: (message: string, kind?: Kind, action?: Action) => void } | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const nextId = useRef(0);
  const [toast, setToast] = useState<{ id: number; message: string; kind: Kind; action?: Action } | null>(null);
  const showToast = useCallback((message: string, kind: Kind = "success", action?: Action) => setToast({ id: ++nextId.current, message, kind, action }), []);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), toast.action || toast.kind === "error" ? 8000 : 4500);
    return () => window.clearTimeout(timer);
  }, [toast]);
  return <ToastContext.Provider value={{ showToast }}>{children}
    {toast && <aside className={`${styles.toast} ${toast.kind === "error" ? styles.error : ""}`} key={toast.id} role={toast.kind === "error" ? "alert" : "status"}>
      {toast.kind === "success" ? <CheckCircle2 size={20} aria-hidden="true"/> : <CircleAlert size={20} aria-hidden="true"/>}
      <span>{toast.message}</span>{toast.action && <button type="button" className={styles.action} onClick={() => { setToast(null); toast.action?.onClick(); }}>{toast.action.label}</button>}<button type="button" aria-label="Dismiss notification" onClick={() => setToast(null)}><X size={18}/></button>
    </aside>}
  </ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("Toast provider is missing.");
  return context;
}

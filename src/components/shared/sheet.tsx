"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, domAnimation, LazyMotion, useIsPresent, useReducedMotion } from "framer-motion";
import * as m from "framer-motion/m";
import { X } from "lucide-react";
import styles from "./sheet.module.css";

type Props = { open: boolean; title: string; onClose: () => void; children: React.ReactNode };

function SheetPanel({ title, onClose, children }: Omit<Props, "open">) {
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const reduced = useReducedMotion();
  const present = useIsPresent();
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();
    close.current?.focus({ preventScroll: true });
    return () => {
      element?.close();
      document.body.style.overflow = overflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={dialog} className={styles.dialog} aria-label={title} aria-modal="true" data-closing={!present || undefined}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <m.section className={styles.panel} inert={!present} initial={reduced ? false : { y: 70, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: reduced ? 0 : 35, opacity: 0 }}
      transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 36, mass: .85 }}>
      <div className={styles.handle} aria-hidden="true"/>
      <header className={styles.header}><h2>{title}</h2><button ref={close} type="button" aria-label={`Close ${title.toLowerCase()}`} onClick={onClose}><X size={20}/></button></header>
      <div className={styles.content}>{children}</div>
    </m.section>
  </dialog>;
}

export function Sheet({ open, ...props }: Props) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(<LazyMotion features={domAnimation} strict><AnimatePresence>{open && <SheetPanel key="sheet" {...props}/>}</AnimatePresence></LazyMotion>, document.body);
}

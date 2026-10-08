"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, MotionConfig, motion, animate, useDragControls, useIsPresent, useMotionValue, useMotionValueEvent, useReducedMotion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { shouldDeleteSwipedSet, SWIPE_DELETE_LIMIT } from "@/features/workouts/set-deletion";
import styles from "./animated-set-row.module.css";

const spring = { type: "spring" as const, stiffness: 400, damping: 30 };

export function SetRows({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user"><AnimatePresence initial={false}>{children}</AnimatePresence></MotionConfig>;
}

export function AnimatedSetRow({ children, className, onDelete, deleteLabel }: {
  children: React.ReactNode; className: string; onDelete?: () => void; deleteLabel?: string;
}) {
  const reduced = useReducedMotion();
  const present = useIsPresent();
  const ref = useRef<HTMLDivElement>(null);
  const [animating, setAnimating] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [armed, setArmed] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const controls = useDragControls();
  const x = useMotionValue(0);
  const deleted = useRef(false);
  const reset = useRef<{ stop: () => void } | null>(null);
  useMotionValueEvent(x, "change", value => { setArmed(shouldDeleteSwipedSet(value)); setRevealed(Math.abs(value) > .1); });
  useEffect(() => () => reset.current?.stop(), []);
  useEffect(() => {
    if (present) { deleted.current = false; reset.current?.stop(); x.set(0); return; }
    if (!present && ref.current?.contains(document.activeElement)) {
      ref.current.closest("article")?.querySelector<HTMLButtonElement>(".add-set-button")?.focus({ preventScroll: true });
    }
  }, [present, x]);
  return <motion.div ref={ref} inert={!present} aria-hidden={!present || undefined} data-set-presence={present ? "present" : "exiting"}
    initial={reduced ? false : { height: 0, opacity: 0, y: -5 }}
    animate={{ height: "auto", opacity: 1, y: 0 }}
    exit={{ height: 0, opacity: 0 }}
    transition={reduced ? { duration: 0 } : { height: spring, y: spring, opacity: { duration: .16 } }}
    onAnimationStart={() => setAnimating(true)} onAnimationComplete={() => setAnimating(false)}
    style={{ overflow: animating || !present ? "hidden" : "visible" }}>
    <div className={styles.track} data-swipe-row style={{ overflow: dragging || revealed || !present ? "hidden" : "visible" }}>
      {onDelete && <div className={styles.delete} data-armed={armed} aria-hidden="true"><Trash2/><span>{armed ? "Release to delete" : "Delete"}</span></div>}
      <motion.div className={styles.front} data-swipe-content role="group" aria-label={deleteLabel}
        drag={onDelete && present ? "x" : false} dragListener={false} dragControls={controls}
        dragConstraints={{ left: -SWIPE_DELETE_LIMIT, right: 0 }} dragElastic={0} dragMomentum={false} dragDirectionLock
        style={{ x, touchAction: "pan-y" }}
        onPointerDown={event => {
          if (!onDelete || !present || deleted.current || event.button !== 0 || !event.isPrimary) return;
          if (event.target instanceof Element && event.target.closest("input,button,select,textarea,summary,a,[role=button],[contenteditable=true]")) return;
          if (ref.current?.querySelector("details[open]")) return;
          reset.current?.stop();
          controls.start(event);
        }}
        onDragStart={() => setDragging(true)}
        onDragEnd={() => {
          setDragging(false);
          if (onDelete && present && !deleted.current && shouldDeleteSwipedSet(x.get())) {
            deleted.current = true;
            onDelete();
          } else reset.current = animate(x, 0, reduced ? { duration: 0 } : spring);
        }}>
        <div className={className}>{children}</div>
      </motion.div>
    </div>
  </motion.div>;
}

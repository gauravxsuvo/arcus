"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Share2 } from "lucide-react";
import type { WorkoutRecord } from "@/features/workouts/model";

const WorkoutShareModal = dynamic(
  () => import("./workout-share-modal").then(module => module.WorkoutShareModal),
  { ssr: false, loading: () => <span role="status" className="inline-message">Loading sharing tools…</span> },
);

export function WorkoutShareTrigger({ workout }: { workout: WorkoutRecord }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (!open) triggerRef.current?.focus(); }, [open]);
  return <>
    <button ref={triggerRef} type="button" className="outline-button" onClick={() => setOpen(true)}>
      <Share2 size={16} aria-hidden="true"/> Share workout
    </button>
    {open && <WorkoutShareModal workout={workout} onClose={() => setOpen(false)}/>}
  </>;
}

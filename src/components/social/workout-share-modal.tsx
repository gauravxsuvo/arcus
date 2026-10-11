"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, LoaderCircle, Share2, X } from "lucide-react";
import { useProfile } from "@/components/shared/user-profile-provider";
import { getCompletedWorkouts } from "@/features/workouts/repository";
import type { WorkoutRecord } from "@/features/workouts/model";
import { detectRecords } from "@/features/training/logic";
import { downloadImage, generateStoryImage, shareOrDownloadImage } from "@/lib/share-image";
import { WorkoutStoryCard } from "./WorkoutStoryCard";
import styles from "./workout-share.module.css";

type BusyState = "capturing" | "sharing" | "saving" | null;

export function WorkoutShareModal({ workout }: { workout: WorkoutRecord }) {
  const { user, preferences } = useProfile();
  const [open, setOpen] = useState(false);
  const [records, setRecords] = useState(0);
  const [recordsReady, setRecordsReady] = useState(false);
  const [image, setImage] = useState<Blob | null>(null);
  const [busy, setBusy] = useState<BusyState>(null);
  const [message, setMessage] = useState("");
  const storyRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const identity = {
    name: user?.name?.trim() || "Athlete",
    handle: user?.username?.trim() || "athlete",
    avatarUrl: user?.profile.avatarUrl ?? null,
  };

  useEffect(() => {
    if (!open) return;
    const opener = openerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "Tab" && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])');
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    requestAnimationFrame(() => modalRef.current?.querySelector<HTMLButtonElement>("button")?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      opener?.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setImage(null);
    setRecordsReady(false);
    setBusy("capturing");
    setMessage("");
    void getCompletedWorkouts().then((history) => {
      if (!cancelled) {
        setRecords(detectRecords(history).filter((record) => record.workoutId === workout.id).length);
        setRecordsReady(true);
      }
    }).catch(() => {
      if (!cancelled) {
        setRecords(0);
        setRecordsReady(true);
      }
    });
    return () => { cancelled = true; };
  }, [open, workout.id]);

  useEffect(() => {
    if (!open || !recordsReady || !storyRef.current) return;
    let cancelled = false;
    setBusy("capturing");
    void generateStoryImage(storyRef.current).then((blob) => {
      if (!cancelled) { setImage(blob); setBusy(null); }
    }).catch((error: unknown) => {
      if (!cancelled) {
        setBusy(null);
        setMessage(error instanceof Error ? error.message : "Could not create your story image.");
      }
    });
    return () => { cancelled = true; };
  }, [open, recordsReady, records, workout]);

  async function exportImage(mode: "share" | "save") {
    if (!image || busy) return;
    setBusy(mode === "share" ? "sharing" : "saving");
    setMessage("");
    const filename = `arcus-${workout.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workout"}.png`;
    try {
      if (mode === "save") {
        downloadImage(image, filename);
        setMessage("Workout story saved as a PNG image.");
      } else {
        const result = await shareOrDownloadImage(image, filename);
        setMessage(result.shared ? "Choose Instagram, Snapchat, or another app from the share sheet." : "Image saved. Open it from your files or photos to share it.");
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setMessage(error instanceof Error ? error.message : "Could not export your workout image.");
    } finally { setBusy(null); }
  }

  const cardProps = { workout, units: preferences.units, identity, records };
  const waiting = busy === "capturing";

  return <>
    <button ref={openerRef} type="button" className="outline-button" onClick={() => setOpen(true)}><Share2 size={16} aria-hidden="true"/> Share workout</button>
    {open && createPortal(<div className={styles.modalBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setOpen(false); }}>
      <div ref={modalRef} className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="workout-share-title" aria-describedby="workout-share-description">
        <header className={styles.modalHeader}><div><h2 id="workout-share-title">Share your session</h2><p id="workout-share-description">A story-sized card, ready for your camera roll.</p></div><button className={styles.closeButton} type="button" aria-label="Close share workout dialog" onClick={() => setOpen(false)} disabled={Boolean(busy)}><X size={19}/></button></header>
        <div className={styles.previewStage}><WorkoutStoryCard {...cardProps} className={styles.storyPreview}/></div>
        <div className={styles.modalActions}>
          <button className={styles.shareButton} type="button" disabled={!image || Boolean(busy)} onClick={() => void exportImage("share")}>
            {busy === "sharing" ? <LoaderCircle size={17} className="saving-spinner" aria-hidden="true"/> : waiting ? <LoaderCircle size={17} className="saving-spinner" aria-hidden="true"/> : <Share2 size={17} aria-hidden="true"/>}
            {busy === "sharing" ? "Opening share sheet…" : waiting ? "Preparing image…" : "Share to Instagram / Stories"}
          </button>
          <button className={styles.saveButton} type="button" disabled={!image || Boolean(busy)} onClick={() => void exportImage("save")}>
            {busy === "saving" ? <LoaderCircle size={17} className="saving-spinner" aria-hidden="true"/> : <Download size={17} aria-hidden="true"/>}
            {busy === "saving" ? "Saving image…" : "Save to camera roll"}
          </button>
        </div>
        <p className={styles.shareMessage} role="status" aria-live="polite">{message || (waiting ? "Preparing a crisp 9:16 image…" : "Your workout details stay on this device until you choose to share.")}</p>
        <div className={styles.captureStage} aria-hidden="true"><WorkoutStoryCard {...cardProps} ref={storyRef}/></div>
      </div>
    </div>, document.body)}
  </>;
}

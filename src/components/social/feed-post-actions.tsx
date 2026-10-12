"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Heart, MessageCircle, Share2 } from "lucide-react";
import { setWorkoutLike, setWorkoutVisibility } from "@/features/social/actions";
import { useToast } from "@/components/shared/toast-provider";
import styles from "./social-feed.module.css";

const CommentsDrawer = dynamic(() => import("./comments-drawer").then(module => module.CommentsDrawer), { ssr: false });

export function FeedPostActions({ ownerId, workoutId, viewerId, initialLikes, initialComments, initiallyLiked }: {
  ownerId: string; workoutId: string; viewerId: string | null; initialLikes: number; initialComments: number; initiallyLiked: boolean;
}) {
  const [liked,setLiked] = useState(initiallyLiked);
  const [likes,setLikes] = useState(initialLikes);
  const [count,setCount] = useState(initialComments);
  const [commentsOpen,setCommentsOpen] = useState(false);
  const [pending,setPending] = useState(false);
  const [hidden,setHidden] = useState(false);
  const { showToast } = useToast();
  async function toggleLike() {
    if (pending) return;
    const before = liked; setLiked(!before); setLikes(value => value + (before ? -1 : 1)); setPending(true);
    try { await setWorkoutLike({ ownerId,workoutId,liked:!before }); }
    catch { setLiked(before); setLikes(value => value + (before ? 1 : -1)); showToast("Failed to like workout. Please sign in and try again.","error"); }
    finally { setPending(false); }
  }
  async function makePrivate() {
    setPending(true);
    try { await setWorkoutVisibility({ ownerId,workoutId,isPublic:false }); setHidden(true); showToast("Workout is now private."); }
    catch { showToast("Could not change visibility.","error"); }
    finally { setPending(false); }
  }
  async function share() {
    const url = `${location.origin}/home`;
    try { if (navigator.share) await navigator.share({ title:"ARCUS workout",url }); else { await navigator.clipboard.writeText(url); showToast("Community link copied."); } }
    catch (error) { if (!(error instanceof Error && error.name === "AbortError")) showToast("Could not share workout.","error"); }
  }
  if (hidden) return null;
  return <>
    <footer className={styles.actions}>
      <button className={styles.action} type="button" disabled={pending} aria-pressed={liked} data-liked={liked} aria-label={`${liked ? "Unlike" : "Like"} workout, ${likes} likes`} onClick={() => void toggleLike()}><Heart size={18} fill={liked ? "currentColor" : "none"}/>{likes}</button>
      <button className={styles.action} type="button" aria-expanded={commentsOpen} aria-label={`Comments, ${count}`} onClick={() => setCommentsOpen(value => !value)}><MessageCircle size={18}/>{count}</button>
      {viewerId === ownerId && <button className={styles.action} type="button" disabled={pending} onClick={() => void makePrivate()}>Make private</button>}
      <button className={`${styles.action} ${styles.shareAction}`} type="button" aria-label="Share workout" onClick={() => void share()}><Share2 size={18}/></button>
    </footer>
    {commentsOpen && <CommentsDrawer ownerId={ownerId} workoutId={workoutId} viewerId={viewerId} onCountChange={delta => setCount(value => Math.max(0,value+delta))} onClose={() => setCommentsOpen(false)}/>}
  </>;
}

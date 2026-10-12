"use client";

import { useEffect, useState, type FormEvent } from "react";
import { LoaderCircle, Trash2, X } from "lucide-react";
import { addWorkoutComment, deleteWorkoutComment, getWorkoutComments } from "@/features/social/actions";
import type { FeedComment } from "@/features/social/model";
import { useToast } from "@/components/shared/toast-provider";
import styles from "./social-feed.module.css";

export function CommentsDrawer({ ownerId, workoutId, viewerId, onCountChange, onClose }: {
  ownerId: string; workoutId: string; viewerId: string | null; onCountChange: (delta: number) => void; onClose: () => void;
}) {
  const [comments, setComments] = useState<FeedComment[]>([]);
  const [text, setText] = useState("");
  const [pending, setPending] = useState(true);
  const [error, setError] = useState(false);
  const { showToast } = useToast();

  async function load() {
    setPending(true); setError(false);
    try { setComments(await getWorkoutComments({ ownerId, workoutId })); }
    catch { setError(true); showToast("Could not load comments.", "error"); }
    finally { setPending(false); }
  }
  useEffect(() => { void load(); // Initial fetch belongs to opening the drawer.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownerId, workoutId]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending || !text.trim()) return;
    const body = text; setPending(true); onCountChange(1);
    try {
      await addWorkoutComment({ ownerId, workoutId, text: body });
      setText(""); showToast("Comment posted.");
      setComments(await getWorkoutComments({ ownerId, workoutId }));
    } catch { onCountChange(-1); showToast("Could not post comment. Use plain text, up to 500 characters, and sign in.", "error"); }
    finally { setPending(false); }
  }

  async function remove(id: string) {
    if (pending) return;
    setPending(true); onCountChange(-1);
    try { await deleteWorkoutComment(id); setComments(rows => rows.filter(row => row.id !== id)); }
    catch { onCountChange(1); showToast("Could not delete comment.", "error"); }
    finally { setPending(false); }
  }

  return <section className={styles.commentPanel} aria-label="Workout comments">
    <header className={styles.commentDrawerHeader}><strong>Comments</strong><button type="button" aria-label="Close comments" onClick={onClose}><X size={18}/></button></header>
    {pending && <LoaderCircle className={styles.spin} size={20} aria-label="Loading comments"/>}
    {error && <button type="button" onClick={() => void load()}>Retry comments</button>}
    {!pending && !error && !comments.length && <p className={styles.commentSample}>No comments yet.</p>}
    {comments.map(comment => <div key={comment.id} className={styles.commentSample}><strong>@{comment.user.handle}</strong> · {comment.text}{comment.user.id === viewerId && <button type="button" aria-label="Delete your comment" disabled={pending} onClick={() => void remove(comment.id)}><Trash2 size={16}/></button>}</div>)}
    <form className={styles.commentForm} onSubmit={submit}><input aria-label="Write a comment" maxLength={500} required value={text} onChange={event => setText(event.target.value)} placeholder="Add a comment…"/><button type="submit" disabled={pending}>Post</button></form>
  </section>;
}

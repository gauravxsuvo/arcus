"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Award, Check, Dumbbell, Heart, MessageCircle, MoreHorizontal, Plus, Send, Share2, Sparkles, Users } from "lucide-react";
import { useToast } from "@/components/shared/toast-provider";
import { mockFeedPosts, suggestedAthletes, type MockAthlete, type MockFeedPost } from "./mock-feed";
import styles from "./social-feed.module.css";

type FeedPostProps = {
  post: MockFeedPost;
  athlete: MockAthlete;
};

export function FeedPost({ post, athlete }: FeedPostProps) {
  const { showToast } = useToast();
  const [liked, setLiked] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [localComments, setLocalComments] = useState<string[]>([]);
  const visibleExercises = post.exercises.slice(0, 3);

  async function sharePost() {
    const text = `${athlete.name} · ${post.title} on ARCUS`;
    try {
      if (navigator.share) await navigator.share({ title: "ARCUS workout", text });
      else if (navigator.clipboard) { await navigator.clipboard.writeText(text); showToast("Workout summary copied to clipboard."); }
      else showToast("Sharing is not available in this browser.", "error");
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") showToast("Could not share this workout.", "error");
    }
  }

  function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = comment.trim();
    if (!trimmed) return;
    setLocalComments((items) => [...items, trimmed]);
    setComment("");
    showToast("Comment added to this local preview.");
  }

  return <article className={styles.post} aria-labelledby={`post-${post.id}`}>
    <header className={styles.postHeader}>
      <span className={`${styles.avatar} ${styles[athlete.accent]}`} aria-hidden="true">{athlete.initials}</span>
      <div className={styles.author}><strong>{athlete.name} <span aria-hidden="true">·</span> @{athlete.username}</strong><span>{post.timeAgo}</span></div>
      <button className={styles.postMenu} type="button" aria-label={`More options for ${athlete.name}'s workout`} onClick={() => showToast("More workout options will be available with social accounts.")}><MoreHorizontal size={19}/></button>
    </header>
    <div className={styles.postTitle}><h3 id={`post-${post.id}`}>{post.title}</h3><p>Put in the work. Logged with ARCUS.</p></div>
    <div className={styles.stats} role="group" aria-label="Workout statistics">
      <div className={styles.stat}><span>Time</span><strong>{post.durationMinutes} min</strong></div>
      <div className={styles.stat}><span>Volume</span><strong>{post.volumeKg ? `${post.volumeKg.toLocaleString()} kg` : "Bodyweight"}</strong></div>
      <div className={`${styles.stat} ${styles.prStat}`}><span>Records</span><strong>{post.personalRecords > 0 ? <><Award size={16} fill="currentColor" aria-hidden="true"/> {post.personalRecords}</> : "—"}</strong></div>
    </div>
    <div className={styles.exerciseSummary} role="group" aria-label="Exercise summary">
      {visibleExercises.map((exercise) => <div className={styles.exerciseRow} key={`${post.id}-${exercise.name}`}><span className={styles.exerciseMark}><Dumbbell size={14}/></span><span><strong>{exercise.sets} sets</strong> {exercise.name}</span></div>)}
    </div>
    {post.exercises.length > 3 && <p className={styles.moreExercises}>+ {post.exercises.length - 3} more exercises</p>}
    <footer className={styles.actions}>
      <button className={styles.action} type="button" aria-pressed={liked} data-liked={liked} aria-label={`${liked ? "Unlike" : "Like"} workout, ${post.likes + Number(liked)} likes`} onClick={() => setLiked((value) => !value)}><Heart size={18} fill={liked ? "currentColor" : "none"}/><span>{post.likes + Number(liked)}</span></button>
      <button className={styles.action} type="button" aria-expanded={commentsOpen} aria-label={`${commentsOpen ? "Hide" : "View"} comments`} onClick={() => setCommentsOpen((value) => !value)}><MessageCircle size={18}/><span>{post.comments + localComments.length}</span></button>
      <button className={`${styles.action} ${styles.shareAction}`} type="button" aria-label="Share workout" onClick={() => void sharePost()}><Share2 size={18}/></button>
    </footer>
    <AnimatePresence initial={false}>
      {commentsOpen && <motion.div className={styles.commentPanel} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: .18 }}>
        {post.comments > 0 && <p className={styles.commentSample}><strong>ARCUS athlete</strong> · Strong session. Keep building.</p>}
        {localComments.map((text, index) => <p className={styles.commentSample} key={`${post.id}-comment-${index}`}><strong>You</strong> · {text}</p>)}
        <form className={styles.commentForm} onSubmit={addComment}><input aria-label="Write a comment" maxLength={300} placeholder="Add a comment…" value={comment} onChange={(event) => setComment(event.target.value)}/><button type="submit" aria-label="Post comment"><Send size={16}/></button></form>
      </motion.div>}
    </AnimatePresence>
  </article>;
}

export function SocialFeed() {
  const [feedTab, setFeedTab] = useState<"following" | "discover">("discover");
  const [followingIds, setFollowingIds] = useState<string[]>(["mira", "niko"]);
  const [visibleCount, setVisibleCount] = useState(3);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const athleteById = useMemo(() => new Map(suggestedAthletes.map((athlete) => [athlete.id, athlete])), []);
  const filteredPosts = useMemo(() => feedTab === "discover" ? mockFeedPosts : mockFeedPosts.filter((post) => followingIds.includes(post.athleteId)), [feedTab, followingIds]);
  const visiblePosts = filteredPosts.slice(0, visibleCount);
  const following = useCallback((id: string) => followingIds.includes(id), [followingIds]);

  useEffect(() => {
    setVisibleCount(3);
  }, [feedTab, followingIds]);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || visibleCount >= filteredPosts.length || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setVisibleCount((count) => Math.min(count + 2, filteredPosts.length));
    }, { rootMargin: "260px 0px" });
    observer.observe(target);
    return () => observer.disconnect();
  }, [filteredPosts.length, visibleCount]);

  function toggleFollow(id: string) {
    setFollowingIds((items) => items.includes(id) ? items.filter((item) => item !== id) : [...items, id]);
  }

  return <main className={`${styles.page} social-shell`}>
    <div className={styles.topline}><p className={styles.eyebrow}><span className={styles.liveDot}/> ARCUS COMMUNITY · PREVIEW</p><Link href="/pro" className={styles.proLink}><Sparkles size={15}/> Try ARCUS Pro</Link></div>
    <header className={styles.titleRow}><div><h1>Home</h1><p>Good sessions travel. See what your training circle is working on.</p></div><Link className={styles.trainingLink} href="/dashboard"><span>Your training</span><Dumbbell size={17}/></Link></header>
    <div className={styles.tabs} role="tablist" aria-label="Workout feed" onKeyDown={event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === "Home" ? "following" : event.key === "End" ? "discover" : feedTab === "following" ? "discover" : "following";
      setFeedTab(next);
      document.getElementById(`social-tab-${next}`)?.focus();
    }}>
      <button className={styles.tab} type="button" role="tab" id="social-tab-following" aria-controls="social-feed-panel" tabIndex={feedTab === "following" ? 0 : -1} aria-selected={feedTab === "following"} onClick={() => setFeedTab("following")}><Users size={16} aria-hidden="true"/> Following</button>
      <button className={styles.tab} type="button" role="tab" id="social-tab-discover" aria-controls="social-feed-panel" tabIndex={feedTab === "discover" ? 0 : -1} aria-selected={feedTab === "discover"} onClick={() => setFeedTab("discover")}><Sparkles size={15} aria-hidden="true"/> Discover</button>
    </div>
    <section aria-labelledby="suggested-athletes-heading">
      <div className={styles.sectionHeading}><div><h2 id="suggested-athletes-heading">Suggested athletes</h2><p>Find people to keep you moving.</p></div></div>
      <div className={styles.suggestedRail}>
        {suggestedAthletes.map((athlete) => {
          const isFollowing = following(athlete.id);
          return <motion.article className={styles.athleteCard} key={athlete.id} whileTap={{ scale: .985 }}>
            <div className={styles.athleteTop}><span className={`${styles.avatar} ${styles[athlete.accent]}`} aria-hidden="true">{athlete.initials}</span><div className={styles.athleteName}><strong>{athlete.name}</strong><span>@{athlete.username}</span></div></div>
            <p className={styles.tagline}>{athlete.tagline}</p>
            <button className={styles.followButton} data-following={isFollowing} type="button" aria-pressed={isFollowing} onClick={() => toggleFollow(athlete.id)}>{isFollowing ? <><Check size={14}/> Following</> : <><Plus size={14}/> Follow</>}</button>
          </motion.article>;
        })}
      </div>
    </section>
    <section role="tabpanel" id="social-feed-panel" aria-labelledby={`social-tab-${feedTab}`} tabIndex={0}>
      <div className={`${styles.sectionHeading} ${styles.feedHeading}`}><div><h2 id="workout-feed-heading">{feedTab === "following" ? "From your circle" : "Training around ARCUS"}</h2><p>{feedTab === "following" ? "Recent sessions from athletes you follow." : "Public workout inspiration from the community."}</p></div></div>
      {visiblePosts.length ? <div className={styles.feedList}>{visiblePosts.map((post) => {
        const athlete = athleteById.get(post.athleteId);
        return athlete ? <FeedPost key={post.id} post={post} athlete={athlete}/> : null;
      })}</div> : <div className={styles.empty}><Users size={24}/><h3>Your circle is getting started.</h3><p>Follow a suggested athlete or explore Discover to see more training sessions.</p><button type="button" onClick={() => setFeedTab("discover")}>Explore Discover</button></div>}
      {visibleCount < filteredPosts.length && <><div className={styles.loadMore} ref={loadMoreRef}><button type="button" onClick={() => setVisibleCount((count) => Math.min(count + 2, filteredPosts.length))}>Load more sessions</button></div></>}
    </section>
    <p className={styles.demoNote}>This is a sample feed. Likes, follows, and comments stay in this preview; community accounts and live workout sharing are not connected yet.</p>
  </main>;
}

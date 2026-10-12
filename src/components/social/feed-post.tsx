import Image from "next/image";
import { Dumbbell, Trophy } from "lucide-react";
import type { FeedWorkout, PublicUser } from "@/features/social/model";
import { FeedFollowButton } from "./feed-follow-button";
import { FeedPostActions } from "./feed-post-actions";
import styles from "./social-feed.module.css";

function Avatar({ user }: { user: PublicUser }) {
  return <span className={styles.avatar}>{user.avatarUrl ? <Image src={user.avatarUrl} alt="" width={42} height={42} unoptimized/> : user.name.slice(0,2).toUpperCase()}</span>;
}

export function FeedPost({ post, viewerId }: { post: FeedWorkout; viewerId: string | null }) {
  const date = new Intl.DateTimeFormat("en-US", { dateStyle:"medium",timeStyle:"short",timeZone:"UTC" }).format(new Date(post.completedAt));
  return <article className={styles.post}>
    <header className={styles.postHeader}><Avatar user={post.user}/><div className={styles.author}><strong>{post.user.name} · @{post.user.handle}</strong><time dateTime={post.completedAt}>{date} UTC</time></div>
      {viewerId !== post.ownerId && <FeedFollowButton user={post.user}/>}
    </header>
    <div className={styles.postTitle}><h3>{post.title}{post.prsCount > 0 && <span className={styles.prBadge} aria-label={`${post.prsCount} personal records`}><Trophy size={15} aria-hidden="true"/> {post.prsCount} PR{post.prsCount === 1 ? "" : "s"}</span>}</h3></div>
    <div className={styles.stats} role="group" aria-label="Workout statistics">
      <div className={styles.stat}><span>Time</span><strong>{post.durationMinutes} min</strong></div>
      <div className={styles.stat}><span>Volume</span><strong>{post.volumeKg.toLocaleString("en-US")} kg</strong></div>
      <div className={styles.stat}><span>Sets</span><strong>{post.totalSets}</strong></div>
    </div>
    <div className={styles.exerciseSummary}>{post.exercises.slice(0,3).map((exercise,index)=><div className={styles.exerciseRow} key={`${exercise.name}-${index}`}><Dumbbell size={16} aria-hidden="true"/><span>{exercise.sets} sets · {exercise.name}</span></div>)}</div>
    {post.exercises.length > 3 && <p className={styles.moreExercises}>+ {post.exercises.length-3} more exercises</p>}
    <FeedPostActions ownerId={post.ownerId} workoutId={post.id} viewerId={viewerId} initialLikes={post.likes} initialComments={post.comments} initiallyLiked={post.liked}/>
  </article>;
}

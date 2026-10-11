"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import { Dumbbell, Heart, MessageCircle, Search, Share2, LoaderCircle, Trash2 } from "lucide-react";
import { useToast } from "@/components/shared/toast-provider";
import { useDebounce } from "@/hooks/useDebounce";
import { addWorkoutComment, deleteWorkoutComment, getFeedWorkoutsPage, getWorkoutComments, searchUsers, setFollowing, setWorkoutLike, setWorkoutVisibility } from "@/features/social/actions";
import type { FeedComment, FeedCursor, FeedWorkout, PublicUser } from "@/features/social/model";
import styles from "./social-feed.module.css";

function Avatar({ user }: { user: PublicUser }) {
  return <span className={styles.avatar}>{user.avatarUrl
    ? <Image src={user.avatarUrl} alt="" width={42} height={42} unoptimized />
    : user.name.slice(0,2).toUpperCase()}</span>;
}
export function FeedEmptyState() {
  return <div className={styles.empty + " flex flex-col items-center justify-center"}>
    <Dumbbell size={32} aria-hidden="true"/><h3>No public workouts yet.</h3>
    <p>Start a session and give your training circle something to celebrate.</p>
    <Link className="action-button" href="/workout">Start a workout</Link>
  </div>;
}
type FollowControl = { pendingIds: Set<string>; toggle: (user: PublicUser) => Promise<void> };
function FollowButton({ user, control }: { user: PublicUser; control: FollowControl }) {
  const pending = control.pendingIds.has(user.id);
  return <button type="button" className={styles.followButton} data-following={user.following} aria-pressed={user.following} disabled={pending} onClick={() => void control.toggle(user)}>{pending && <LoaderCircle size={14} className={styles.spin}/>} {user.following ? "Following" : "Follow"}</button>;
}
export function FeedPost({ post,viewerId,onFollow }: { post: FeedWorkout; viewerId: string | null; onFollow: FollowControl }) {
  const { showToast } = useToast();
  const [liked,setLiked] = useState(post.liked);
  const [likes,setLikes] = useState(post.likes);
  const [likePending,setLikePending] = useState(false);
  const likeLock = useRef(false);
  const [commentsOpen,setCommentsOpen] = useState(false);
  const [comments,setComments] = useState<FeedComment[]>([]);
  const [count,setCount] = useState(post.comments);
  const [text,setText] = useState("");
  const [pending,setPending] = useState(false);
  const [commentsError,setCommentsError] = useState(false);
  const [date,setDate] = useState("");
  useEffect(() => { setDate(new Date(post.completedAt).toLocaleString()); }, [post.completedAt]);
  async function like() {
    if (likeLock.current) return;
    likeLock.current=true;
    const before=liked;
    setLiked(!before); setLikes(n=>n+(before ? -1 : 1)); setLikePending(true);
    try { await setWorkoutLike({ ownerId:post.ownerId,workoutId:post.id,liked:!before }); }
    catch { setLiked(before); setLikes(n=>n+(before ? 1 : -1)); showToast("Failed to like workout. Please sign in and try again.","error"); }
    finally { likeLock.current=false; setLikePending(false); }
  }
  async function loadComments() {
    setPending(true); setCommentsError(false);
    try { setComments(await getWorkoutComments({ ownerId:post.ownerId,workoutId:post.id })); }
    catch { setCommentsError(true); showToast("Could not load comments.","error"); }
    finally { setPending(false); }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending || !text.trim()) return;
    setPending(true);
    try {
      await addWorkoutComment({ ownerId:post.ownerId,workoutId:post.id,text });
      setText(""); setCount(n=>n+1); showToast("Comment posted.");
      setComments(await getWorkoutComments({ ownerId:post.ownerId,workoutId:post.id }));
    } catch { showToast("Could not post comment. Use plain text, up to 500 characters, and sign in.","error"); }
    finally { setPending(false); }
  }
  async function removeComment(id: string) {
    if (pending) return;
    setPending(true);
    try { await deleteWorkoutComment(id); setComments(rows=>rows.filter(row=>row.id!==id)); setCount(n=>Math.max(0,n-1)); }
    catch { showToast("Could not delete comment.","error"); }
    finally { setPending(false); }
  }
  const [hidden,setHidden] = useState(false);
  async function makePrivate() {
    setPending(true);
    try { await setWorkoutVisibility({ ownerId:post.ownerId,workoutId:post.id,isPublic:false }); setHidden(true); showToast("Workout is now private."); }
    catch { showToast("Could not change visibility.","error"); }
    finally { setPending(false); }
  }
  async function share() {
    const url = location.origin+"/home";
    try {
      if (navigator.share) await navigator.share({ title:post.title,text:post.user.name+" on ARCUS",url });
      else { await navigator.clipboard.writeText(url); showToast("Community link copied."); }
    } catch (error) { if (!(error instanceof Error && error.name==="AbortError")) showToast("Could not share workout.","error"); }
  }
  if (hidden) return null;
  return <article className={styles.post}>
    <header className={styles.postHeader}><Avatar user={post.user}/><div className={styles.author}><strong>{post.user.name} · @{post.user.handle}</strong><time dateTime={post.completedAt}>{date || "Completed workout"}</time></div>
      {viewerId!==post.ownerId && <FollowButton user={post.user} control={onFollow}/>}
    </header>
    <div className={styles.postTitle}><h3>{post.title}</h3></div>
    <div className={styles.stats} role="group" aria-label="Workout statistics">
      <div className={styles.stat}><span>Time</span><strong>{post.durationMinutes} min</strong></div>
      <div className={styles.stat}><span>Volume</span><strong>{post.volumeKg.toLocaleString("en-US")} kg</strong></div>
      <div className={styles.stat}><span>Exercises</span><strong>{post.exercises.length}</strong></div>
    </div>
    <div className={styles.exerciseSummary}>{post.exercises.slice(0,3).map((exercise,index)=><div className={styles.exerciseRow} key={index}><Dumbbell size={16} aria-hidden="true"/><span>{exercise.sets} sets · {exercise.name}</span></div>)}</div>
    {post.exercises.length>3 && <p className={styles.moreExercises}>+ {post.exercises.length-3} more exercises</p>}
    <footer className={styles.actions}>
      <button className={styles.action} type="button" disabled={likePending} aria-pressed={liked} data-liked={liked} aria-label={(liked?"Unlike":"Like")+" workout, "+likes+" likes"} onClick={()=>void like()}><Heart size={18} fill={liked?"currentColor":"none"}/>{likes}</button>
      <button className={styles.action} type="button" aria-expanded={commentsOpen} aria-label={"Comments, "+count} onClick={()=>{ setCommentsOpen(!commentsOpen); if (!commentsOpen) void loadComments(); }}><MessageCircle size={18}/>{count}</button>
      {viewerId===post.ownerId && <button className={styles.action} type="button" disabled={pending} onClick={()=>void makePrivate()}>Make private</button>}
      <button className={styles.action+" "+styles.shareAction} type="button" aria-label="Share workout" onClick={()=>void share()}><Share2 size={18}/></button>
    </footer>
    {commentsOpen && <div className={styles.commentPanel}>
      {pending && <LoaderCircle className={styles.spin} size={20} aria-label="Loading comments"/>}
      {commentsError && <button type="button" onClick={()=>void loadComments()}>Retry comments</button>}
      {!pending && !commentsError && !comments.length && <p className={styles.commentSample}>No comments yet.</p>}
      {comments.map(comment=><div key={comment.id} className={styles.commentSample}><strong>@{comment.user.handle}</strong> · {comment.text}{comment.user.id===viewerId && <button type="button" aria-label="Delete your comment" disabled={pending} onClick={()=>void removeComment(comment.id)}><Trash2 size={16}/></button>}</div>)}
      <form className={styles.commentForm} onSubmit={submit}><input aria-label="Write a comment" maxLength={500} required value={text} onChange={event=>setText(event.target.value)} placeholder="Add a comment…"/><button type="submit" disabled={pending}>Post</button></form>
    </div>}
  </article>;
}
export function SocialFeed({ initialPosts,initialCursor,viewerId,initialError=false }: { initialPosts: FeedWorkout[]; initialCursor: FeedCursor | null; viewerId: string | null; initialError?: boolean }) {
  const [tab,setTab] = useState<"discover" | "following">("discover");
  const [posts,setPosts] = useState(initialPosts);
  const [nextCursor,setNextCursor] = useState<FeedCursor | null>(initialCursor);
  const [loading,setLoading] = useState(false);
  const [paging,setPaging] = useState(false);
  const [error,setError] = useState(initialError);
  const requestId = useRef(0);
  const { showToast } = useToast();
  const [query,setQuery] = useState("");
  const debounced = useDebounce(query,300);
  const [users,setUsers] = useState<PublicUser[]>([]);
  const [searchPending,setSearchPending] = useState(false);
  const [searchError,setSearchError] = useState(false);
  const [searchOpen,setSearchOpen] = useState(false);
  const searchBox = useRef<HTMLDivElement>(null);
  useEffect(()=>{
    const close = (event: PointerEvent) => { if (!searchBox.current?.contains(event.target as Node)) setSearchOpen(false); };
    document.addEventListener("pointerdown",close); return ()=>document.removeEventListener("pointerdown",close);
  },[]);
  useEffect(()=>{
    let cancelled=false;
    setUsers([]); setSearchError(false);
    if (debounced.trim().length<2) { setSearchPending(false); return; }
    setSearchPending(true);
    searchUsers(debounced).then(rows=>{ if(!cancelled) setUsers(rows); }).catch(()=>{ if(!cancelled) setSearchError(true); }).finally(()=>{ if(!cancelled) setSearchPending(false); });
    return ()=>{cancelled=true;};
  },[debounced]);
  async function load(mode: "discover" | "following") {
    const id=++requestId.current;
    setTab(mode); setLoading(true); setPaging(false); setError(false);
    try { const page=await getFeedWorkoutsPage({ tab: mode }); if (id===requestId.current) { setPosts(page.posts); setNextCursor(page.nextCursor); } }
    catch { if(id===requestId.current) { setError(true); showToast("Feed unavailable. Try again.","error"); } }
    finally { if(id===requestId.current) setLoading(false); }
  }
  async function loadMore() {
    if (!nextCursor || loading || paging) return;
    const id=requestId.current;
    setPaging(true);
    try {
      const page=await getFeedWorkoutsPage({ tab, cursor: nextCursor });
      if(id===requestId.current) {
        setPosts(current=>[...current,...page.posts.filter(post=>!current.some(existing=>existing.id===post.id&&existing.ownerId===post.ownerId))]);
        setNextCursor(page.nextCursor);
      }
    } catch {
      if(id===requestId.current) showToast("Could not load more workouts. Try again.","error");
    } finally { if(id===requestId.current) setPaging(false); }
  }
  const followLocks = useRef(new Set<string>());
  const [pendingFollowIds,setPendingFollowIds] = useState(new Set<string>());
  function updateFollowing(id: string,value: boolean) {
    setUsers(rows=>rows.map(user=>user.id===id ? {...user,following:value} : user));
    setPosts(rows=>rows.map(post=>post.ownerId===id ? {...post,user:{...post.user,following:value}} : post));
  }
  const followControl: FollowControl = { pendingIds:pendingFollowIds,toggle:async user=>{
    if(followLocks.current.has(user.id))return;
    followLocks.current.add(user.id);
    setPendingFollowIds(new Set(followLocks.current));
    updateFollowing(user.id,!user.following);
    try { await setFollowing({userId:user.id,following:!user.following}); }
    catch { updateFollowing(user.id,user.following); showToast("Failed to follow user. Please sign in and try again.","error"); }
    finally { followLocks.current.delete(user.id); setPendingFollowIds(new Set(followLocks.current)); }
  }};
  const visiblePosts=tab==="following" ? posts.filter(post=>post.user.following) : posts;
  return <main className={styles.page+" social-shell"}>
    <div className={styles.topline}><p className={styles.eyebrow}>ARCUS COMMUNITY</p><Link href="/dashboard" className={styles.trainingLink}>Your training<Dumbbell size={18} aria-hidden="true"/></Link></div>
    <header className={styles.titleRow}><div><h1>Home</h1><p>Good sessions travel. Find your training circle.</p></div></header>
    <div className={styles.searchBox} ref={searchBox}>
      <div className={styles.searchInput+" bg-white/5 backdrop-blur-md border border-white/10 rounded-xl focus-within:ring-2 focus-within:ring-blue-500"}><Search size={18} aria-hidden="true"/><input type="search" role="combobox" aria-autocomplete="list" aria-label="Search profiles" aria-expanded={searchOpen && query.trim().length>=2} aria-controls="profile-search-results" placeholder="Search names or handles" maxLength={80} value={query} onFocus={()=>setSearchOpen(true)} onKeyDown={event=>{if(event.key==="Escape")setSearchOpen(false);}} onChange={event=>{setQuery(event.target.value);setSearchOpen(true);}}/></div>
      {searchOpen && query.trim().length>=2 && <div id="profile-search-results" className={styles.searchResults+" absolute z-50 mt-2 w-full shadow-xl"} aria-live="polite">
        {searchPending || query!==debounced ? [0,1,2].map(row=><div className={styles.skeleton+" animate-pulse bg-white/10"} key={row} aria-label="Searching"/>) : searchError ? <p>Search unavailable. Try again.</p> : users.length ? users.map(user=><div className={styles.searchRow} key={user.id}><Avatar user={user}/><div><strong>{user.name}</strong><span>@{user.handle}</span></div><FollowButton user={user} control={followControl}/></div>) : <p>No profiles found.</p>}
      </div>}
    </div>
    <div className={styles.tabs} role="tablist" aria-label="Workout feed" onKeyDown={event=>{
      if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
      event.preventDefault();
      const next=event.key==="Home"?"following":event.key==="End"?"discover":tab==="following"?"discover":"following";
      void load(next); document.getElementById("social-tab-"+next)?.focus();
    }}>
      {(["following","discover"] as const).map(mode=><button key={mode} type="button" className={styles.tab} role="tab" id={"social-tab-"+mode} aria-controls="social-feed-panel" aria-selected={tab===mode} tabIndex={tab===mode?0:-1} onClick={()=>void load(mode)}>{mode==="following"?"Following":"Discover"}</button>)}
    </div>
    <section role="tabpanel" id="social-feed-panel" tabIndex={0} aria-labelledby={"social-tab-"+tab} aria-busy={loading}>
      {loading ? <div className={styles.empty}><LoaderCircle className={styles.spin} aria-label="Loading feed"/></div> : error ? <div className={styles.empty}><p>We couldn’t load the feed.</p><button type="button" onClick={()=>void load(tab)}>Try again</button></div> : visiblePosts.length ? <><div className={styles.feedList}>{visiblePosts.map(post=><FeedPost key={post.ownerId+post.id} post={post} viewerId={viewerId} onFollow={followControl}/>)}</div>{nextCursor && <div className={styles.loadMore}><button type="button" disabled={paging} onClick={()=>void loadMore()}>{paging && <LoaderCircle className={styles.spin}/>} {paging ? "Loading…" : "Load more workouts"}</button></div>}</> : <FeedEmptyState/>}
    </section>
  </main>;
}

import { Suspense } from "react";
import Link from "next/link";
import { Dumbbell } from "lucide-react";
import { FeedPost } from "@/components/social/feed-post";
import { ProfileSearch } from "@/components/social/profile-search";
import { getFeedWorkoutsPage } from "@/features/social/actions";
import type { FeedCursor } from "@/features/social/model";
import { getCurrentAccount } from "@/lib/auth/server";
import styles from "@/components/social/social-feed.module.css";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string,string|string[]|undefined>>;
type FeedTab = "following" | "discover";

function scalar(value: string|string[]|undefined) { return Array.isArray(value) ? value[0] : value; }

async function FeedResults({ tab,cursor }: { tab: FeedTab; cursor: FeedCursor | null }) {
  try {
    const [account,page] = await Promise.all([getCurrentAccount(),getFeedWorkoutsPage({ tab,cursor })]);
    if (!page.posts.length) return <div className={styles.empty + " flex flex-col items-center justify-center"}>
      <Dumbbell size={32} aria-hidden="true"/><h3>{tab === "following" ? "No workouts from your circle yet." : "No public workouts yet."}</h3>
      <p>{tab === "following" ? "Follow athletes to see their training here." : "Start a session and give your training circle something to celebrate."}</p>
      <Link className="action-button" href="/workout">Start a workout</Link>
    </div>;
    const next = page.nextCursor;
    const nextHref = next ? { pathname:"/home",query:{ tab,cursorUpdatedAt:next.updatedAt,cursorId:next.id,cursorOwnerId:next.ownerId } } : null;
    return <>
      <div className={styles.feedList}>{page.posts.map(post=><FeedPost key={post.ownerId+post.id} post={post} viewerId={account?.id ?? null}/>)}</div>
      {nextHref && <div className={styles.loadMore}><Link href={nextHref}>Load more workouts</Link></div>}
    </>;
  } catch {
    return <div className={styles.empty}><p>We couldn’t load the feed.</p><Link className="action-button" href="/home">Try again</Link></div>;
  }
}

function FeedSkeleton() {
  return <div className={styles.feedListSkeleton} aria-label="Loading community feed"><span/><span/><span/></div>;
}

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const tab: FeedTab = scalar(params.tab) === "following" ? "following" : "discover";
  const cursorUpdatedAt = scalar(params.cursorUpdatedAt);
  const cursorId = scalar(params.cursorId);
  const cursorOwnerId = scalar(params.cursorOwnerId);
  const cursor = cursorUpdatedAt && cursorId && cursorOwnerId ? { updatedAt:cursorUpdatedAt,id:cursorId,ownerId:cursorOwnerId } : null;
  return <main className={`${styles.page} social-shell`}>
    <div className={styles.feedEntrance}>
      <div className={styles.topline}><p className={styles.eyebrow}>ARCUS COMMUNITY</p><Link href="/dashboard" className={styles.trainingLink}>Your training<Dumbbell size={18} aria-hidden="true"/></Link></div>
      <header className={styles.titleRow}><div><h1>Home</h1><p>Good sessions travel. Find your training circle.</p></div></header>
      <ProfileSearch/>
      <nav className={styles.tabs} aria-label="Workout feed">
        {(["following","discover"] as const).map(mode=><Link key={mode} className={styles.tab} href={{ pathname:"/home",query:{ tab:mode } }} aria-current={tab===mode ? "page" : undefined}>{mode === "following" ? "Following" : "Discover"}</Link>)}
      </nav>
      <section aria-label={`${tab === "following" ? "Following" : "Discover"} workouts`}>
        <Suspense fallback={<FeedSkeleton/>}><FeedResults tab={tab} cursor={cursor}/></Suspense>
      </section>
    </div>
  </main>;
}

import { SocialFeed } from "@/components/social/social-feed";
import { getFeedWorkoutsPage } from "@/features/social/actions";
import { getCurrentAccount } from "@/lib/auth/server";
import type { FeedCursor, FeedWorkout } from "@/features/social/model";
export const dynamic = "force-dynamic";
export default async function HomePage() {
  let account: Awaited<ReturnType<typeof getCurrentAccount>> = null;
  let posts: FeedWorkout[] = [];
  let nextCursor: FeedCursor | null = null;
  let error = false;
  try {
    const [currentAccount, page] = await Promise.all([getCurrentAccount(), getFeedWorkoutsPage()]);
    account = currentAccount;
    posts = page.posts;
    nextCursor = page.nextCursor;
  } catch { error = true; }
  return <SocialFeed initialPosts={posts} initialCursor={nextCursor} viewerId={account?.id ?? null} initialError={error}/>;
}

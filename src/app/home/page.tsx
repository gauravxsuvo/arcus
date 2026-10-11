import { SocialFeed } from "@/components/social/social-feed";
import { getFeedWorkouts } from "@/features/social/actions";
import { getCurrentAccount } from "@/lib/auth/server";
import type { FeedWorkout } from "@/features/social/model";
export const dynamic = "force-dynamic";
export default async function HomePage() {
  let account: Awaited<ReturnType<typeof getCurrentAccount>> = null;
  let posts: FeedWorkout[] = [];
  let error = false;
  try { account = await getCurrentAccount(); posts = await getFeedWorkouts(); } catch { error = true; }
  return <SocialFeed initialPosts={posts} viewerId={account?.id ?? null} initialError={error}/>;
}

"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { setFollowing } from "@/features/social/actions";
import { useToast } from "@/components/shared/toast-provider";
import type { PublicUser } from "@/features/social/model";
import styles from "./social-feed.module.css";

export function FeedFollowButton({ user }: { user: PublicUser }) {
  const [following, setFollowingState] = useState(user.following);
  const [pending, setPending] = useState(false);
  const { showToast } = useToast();
  async function toggle() {
    if (pending) return;
    const before = following; setFollowingState(!before); setPending(true);
    try { await setFollowing({ userId: user.id, following: !before }); }
    catch { setFollowingState(before); showToast("Could not update follow status. Please sign in and try again.", "error"); }
    finally { setPending(false); }
  }
  return <button type="button" className={styles.followButton} data-following={following} aria-pressed={following} disabled={pending} onClick={() => void toggle()}>{pending && <LoaderCircle size={14} className={styles.spin}/>} {following ? "Following" : "Follow"}</button>;
}

"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { searchUsers } from "@/features/social/actions";
import type { PublicUser } from "@/features/social/model";
import { useDebounce } from "@/hooks/useDebounce";
import { FeedFollowButton } from "./feed-follow-button";
import styles from "./social-feed.module.css";

function Avatar({ user }: { user: Pick<PublicUser, "name" | "avatarUrl"> }) {
  return <span className={styles.avatar}>{user.avatarUrl ? <Image src={user.avatarUrl} alt="" width={42} height={42} unoptimized/> : user.name.slice(0,2).toUpperCase()}</span>;
}

export function ProfileSearch() {
  const [query,setQuery] = useState("");
  const [users,setUsers] = useState<PublicUser[]>([]);
  const [pending,setPending] = useState(false);
  const [error,setError] = useState(false);
  const [open,setOpen] = useState(false);
  const debounced = useDebounce(query,300);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: PointerEvent) => { if (!box.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown",close);
    return () => document.removeEventListener("pointerdown",close);
  },[]);
  useEffect(() => {
    let cancelled = false;
    setUsers([]); setError(false);
    if (debounced.trim().length < 2) { setPending(false); return; }
    setPending(true);
    searchUsers(debounced).then(rows => { if (!cancelled) setUsers(rows); }).catch(() => { if (!cancelled) setError(true); }).finally(() => { if (!cancelled) setPending(false); });
    return () => { cancelled = true; };
  },[debounced]);
  const searching = query !== debounced || pending;
  return <div className={styles.searchBox} ref={box}>
    <div className={`${styles.searchInput} bg-white/5 backdrop-blur-md border border-white/10 rounded-xl focus-within:ring-2 focus-within:ring-blue-500`}><Search size={18} aria-hidden="true"/><input type="search" role="combobox" aria-autocomplete="list" aria-label="Search profiles" aria-expanded={open && query.trim().length>=2} aria-controls="profile-search-results" placeholder="Search names or handles" maxLength={80} value={query} onFocus={() => setOpen(true)} onKeyDown={event => { if (event.key === "Escape") setOpen(false); }} onChange={event => { setQuery(event.target.value); setOpen(true); }}/></div>
    {open && query.trim().length >= 2 && <div id="profile-search-results" className={`${styles.searchResults} absolute z-50 mt-2 w-full shadow-xl`} aria-live="polite">
      {searching ? [0,1,2].map(row => <div className={`${styles.skeleton} animate-pulse bg-white/10`} key={row} aria-label="Searching"/>) : error ? <p>Search unavailable. Try again.</p> : users.length ? users.map(user => <div className={styles.searchRow} key={user.id}><Avatar user={user}/><div><strong>{user.name}</strong><span>@{user.handle}</span></div><FeedFollowButton user={user}/></div>) : <p>No profiles found.</p>}
    </div>}
  </div>;
}

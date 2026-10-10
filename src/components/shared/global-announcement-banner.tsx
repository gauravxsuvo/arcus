"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

const DISMISSED_KEY = "arcus-dismissed-announcement";

export function GlobalAnnouncementBanner({ message }: { message: string }) {
  const [dismissed, setDismissed] = useState("");
  useEffect(() => { try { setDismissed(localStorage.getItem(DISMISSED_KEY) ?? ""); } catch { /* Private browsing may block storage. */ } }, []);
  if (!message.trim() || dismissed === message) return null;
  return <aside className="global-announcement" role="status" aria-label="ARCUS announcement"><span className="global-announcement-dot" aria-hidden="true"/><p>{message}</p><button type="button" aria-label="Dismiss announcement" onClick={() => { setDismissed(message); try { localStorage.setItem(DISMISSED_KEY, message); } catch { /* The current view still dismisses. */ } }}><X size={17} aria-hidden="true"/></button></aside>;
}

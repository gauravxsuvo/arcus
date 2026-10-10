"use client";

import { useEffect, useState } from "react";
import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";
import styles from "./cookie-consent.module.css";

const CONSENT_KEY = "arcus-analytics-consent";
const TRACKABLE_ROUTES = new Set([
  "/welcome", "/home", "/dashboard", "/pro", "/login", "/signup", "/privacy", "/terms",
  "/workout", "/history", "/profile", "/programs", "/progress", "/exercises", "/recaps",
]);

function filterAnalyticsEvent(event: BeforeSendEvent) {
  try {
    if (window.localStorage.getItem(CONSENT_KEY) !== "accepted") return null;
  } catch {
    return null;
  }
  const url = new URL(event.url, window.location.origin);
  if (!TRACKABLE_ROUTES.has(url.pathname) || url.pathname.startsWith("/admin")) return null;
  // Drop query strings and fragments so tokens, emails, and other state never
  // end up in the analytics URL.
  return { ...event, url: `${url.origin}${url.pathname}` };
}

export function CookieConsent() {
  const [consent, setConsent] = useState<"accepted" | "declined" | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stored: string | null = null;
    try { stored = window.localStorage.getItem(CONSENT_KEY); } catch { /* Consent remains available for this visit. */ }
    if (stored === "accepted" || stored === "declined") setConsent(stored);
    setReady(true);
    const reset = () => {
      try { window.localStorage.removeItem(CONSENT_KEY); } catch { /* Keep the in-memory choice reset. */ }
      setConsent(null);
    };
    window.addEventListener("arcus-cookie-consent-reset", reset);
    return () => window.removeEventListener("arcus-cookie-consent-reset", reset);
  }, []);

  function choose(value: "accepted" | "declined") {
    try { window.localStorage.setItem(CONSENT_KEY, value); } catch { /* Analytics choice still applies for this visit. */ }
    setConsent(value);
  }

  return <>
    {ready && consent === "accepted" && <Analytics beforeSend={filterAnalyticsEvent}/>}
    {ready && consent === null && <aside className={styles.banner} role="region" aria-label="Cookie and analytics preferences">
      <p>We use cookies to improve your training experience and analyze site traffic.</p>
      <div className={styles.actions}>
        <button type="button" className={styles.decline} onClick={() => choose("declined")}>Decline</button>
        <button type="button" className={styles.accept} onClick={() => choose("accepted")}>Accept</button>
      </div>
    </aside>}
  </>;
}

export function CookiePreferencesButton() {
  return <button className={styles.preferences} type="button" onClick={() => window.dispatchEvent(new Event("arcus-cookie-consent-reset"))}>
    Change cookie preferences
  </button>;
}

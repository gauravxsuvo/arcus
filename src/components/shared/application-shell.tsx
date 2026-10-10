"use client";

import { usePathname } from "next/navigation";
import { ServiceWorkerRegistration } from "./service-worker-registration";
import { SyncManager } from "./sync-manager";
import { MobileAppHeader, MobileNavigation } from "./mobile-navigation";
import { NetworkStatus } from "./network-status";
import { UserProfileProvider } from "./user-profile-provider";
import { ThemeProvider } from "./theme-provider";
import { WorkoutProvider } from "./workout-provider";
import { RecapManager } from "./recap-manager";
import { ToastProvider } from "./toast-provider";
import { RouteTitle } from "./page-title";
import { RouteTransition } from "./route-transition";
import { CookieConsent } from "./cookie-consent";
import { LegalFooter } from "./legal-footer";
import { GlobalAnnouncementBanner } from "./global-announcement-banner";
import { useEffect, useState } from "react";

export function ApplicationShell({ children, currentYear }: { children: React.ReactNode; currentYear: number }) {
  const pathname = usePathname();
  const isAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const isLegal = pathname === "/privacy" || pathname === "/terms";
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    if (isAdmin || isLegal) return;
    let active = true;
    const refresh = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/runtime-flags");
        if (!response.ok) return;
        const data = await response.json() as { maintenanceMode?: boolean; announcement?: string };
        if (active) { setMaintenanceMode(data.maintenanceMode === true); setAnnouncement(typeof data.announcement === "string" ? data.announcement : ""); }
      } catch { /* Local-first app stays usable when the remote database is offline. */ }
    };
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [isAdmin, isLegal, pathname]);

  // Admin identity/data comes only from the server. Do not start device-local
  // workout sync, profile hydration or consumer navigation on owner routes.
  if (isAdmin) return children;
  if (maintenanceMode && !isLegal) return <><GlobalAnnouncementBanner message={announcement}/><main className="runtime-maintenance" role="status">
    <span className="runtime-maintenance-kicker">ARCUS · SYSTEM NOTICE</span>
    <h1>We’ll be back shortly.</h1>
    <p>ARCUS is temporarily paused while maintenance is in progress. Your saved training data remains safe. Please check back soon.</p>
  </main></>;
  return <UserProfileProvider><ThemeProvider><WorkoutProvider><ToastProvider>
    <GlobalAnnouncementBanner message={announcement}/>
    <RouteTitle/><ServiceWorkerRegistration/><SyncManager/><RecapManager/><NetworkStatus/><MobileAppHeader/>
    <RouteTransition>{children}</RouteTransition><MobileNavigation/><LegalFooter year={currentYear} tagline={pathname === "/welcome" ? "CONSISTENCY OVER COMPLEXITY" : undefined}/><CookieConsent/>
  </ToastProvider></WorkoutProvider></ThemeProvider></UserProfileProvider>;
}

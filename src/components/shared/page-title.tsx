"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const titles: Record<string, string> = {
  dashboard: "Home", welcome: "Welcome", workout: "Workout", history: "History",
  exercises: "Exercises", programs: "Programs", progress: "Progress", profile: "Profile",
  recaps: "Weekly recaps", login: "Sign in", signup: "Sign up", onboarding: "Your training profile",
};

export function usePageTitle(title: string) {
  useEffect(() => {
    document.title = `${title} | ARCUS`;
    // Next also commits route metadata during hydration/navigation. Apply the
    // local workout name after that commit rather than losing it to the shell.
    const frame = requestAnimationFrame(() => { document.title = `${title} | ARCUS`; });
    return () => cancelAnimationFrame(frame);
  }, [title]);
}

export function RouteTitle() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  const title = pathname === "/profile/edit" ? "Edit profile" : pathname === "/profile/data" ? "Import & export" : titles[parts[0]] ?? "Page not found";
  usePageTitle(title);
  return null;
}

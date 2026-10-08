"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const tabs = new Set(["/dashboard", "/workout", "/history", "/profile"]);

export function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const previous = useRef(pathname);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const changed = previous.current !== pathname;
    const from = previous.current;
    previous.current = pathname;
    if (!changed || !tabs.has(from) || !tabs.has(pathname) || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Animate the existing content boundary, keeping providers and route state intact.
    const animation = ref.current?.animate([
      { opacity: .7, transform: "translateY(7px)" },
      { opacity: 1, transform: "translateY(0)" },
    ], { duration: 180, easing: "cubic-bezier(.22,1,.36,1)" });
    return () => animation?.cancel();
  }, [pathname]);
  return <div ref={ref} data-route-content>{children}</div>;
}

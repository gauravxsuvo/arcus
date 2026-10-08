"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getLocalSession } from "@/features/local-data/repository";

export function AccountAccess({ className = "", description }: { className?: string; description?: string }) {
  const pathname = usePathname();
  const [signedOut, setSignedOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getLocalSession().then((user) => {
      if (!cancelled) setSignedOut(!user);
    }).catch(() => {
      // Keep account navigation available if local storage cannot be read.
      if (!cancelled) setSignedOut(true);
    });
    return () => { cancelled = true; };
  }, [pathname]);

  if (!signedOut) return null;

  return <div className={`account-access ${className}`} role="group" aria-label="Account access">
    {description && <p>{description}</p>}
    <Link className="account-sign-in" href="/login">Sign in</Link>
    <Link className="account-sign-up" href="/signup">Sign up</Link>
  </div>;
}

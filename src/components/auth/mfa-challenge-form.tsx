"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { cacheRemoteUser, type LocalUser } from "@/features/local-data/repository";

export function MfaChallengeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/mfa/verify", { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const payload = await response.json() as { user?: Omit<LocalUser, "passwordHash" | "createdAt">; error?: string };
      if (!response.ok || !payload.user) throw new Error(payload.error ?? "Could not verify the code.");
      await cacheRemoteUser(payload.user, crypto.randomUUID());
      router.replace("/dashboard"); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not verify the code."); }
    finally { setBusy(false); }
  }
  return <main className="auth-shell"><section className="auth-card"><p className="eyebrow"><span className="live-dot"/> ACCOUNT SECURITY</p><h1>Verify it’s<br/><span>you.</span></h1><p className="auth-intro">Enter the six-digit code from your authenticator app, or use one of your single-use recovery codes.</p><form className="auth-form" onSubmit={(event) => void submit(event)}><label>Authenticator or recovery code<input autoFocus name="code" value={code} onChange={(event) => setCode(event.target.value.trim().slice(0, 40))} inputMode="numeric" autoComplete="one-time-code" maxLength={40} required/></label><button className="action-button auth-submit" disabled={busy}>{busy ? "Verifying…" : "Verify and sign in"}</button></form>{error && <p className="auth-error" role="alert">{error}</p>}</section></main>;
}

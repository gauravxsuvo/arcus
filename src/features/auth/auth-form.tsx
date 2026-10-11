"use client";

import { FormEvent, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Fingerprint } from "lucide-react";
import { startAuthentication } from "@simplewebauthn/browser";
import { cacheRemoteUser, loginLocalUser, registerLocalUser, type LocalUser } from "@/features/local-data/repository";
import { ArcusMark } from "@/components/shared/arcus-mark";
import { restoreLibrary } from "@/features/local-data/sync";
import { restoreWorkouts } from "@/features/workouts/sync";
import { useToast } from "@/components/shared/toast-provider";

class ServerAuthError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function requestServerAuth(path: string, body: Record<string, string>) {
  let response: Response;
  try {
    response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
  } catch {
    throw new Error("offline");
  }
  const payload = await response.json().catch(() => ({})) as { user?: Omit<LocalUser, "passwordHash" | "createdAt">; error?: string; mfaRequired?: boolean };
  if (response.status === 202 && payload.mfaRequired) return { mfaRequired: true as const };
  if (!response.ok || !payload.user) throw new ServerAuthError(payload.error ?? "Could not complete account request.", response.status);
  return { user: payload.user };
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const authFormRef = useRef<HTMLFormElement>(null);
  const signup = mode === "signup";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setNotice(""); setBusy(true);
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const username = String(formData.get("username") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    try {
      if (signup) {
        try {
          const result = await requestServerAuth("/api/auth/signup", { username, email, password, name });
          if ("mfaRequired" in result) throw new Error("Unexpected verification challenge during account creation.");
          await cacheRemoteUser(result.user, password);
          await restoreWorkouts().catch(()=>undefined);
          await restoreLibrary().catch(()=>undefined);
        } catch (reason) {
          if (reason instanceof ServerAuthError) throw reason;
          await registerLocalUser({ username, email, password, name });
        }
        showToast("Your ARCUS account is ready. Let’s set up your training profile.");
        router.push("/onboarding");
      } else {
        try {
          const result = await requestServerAuth("/api/auth/login", { username, password });
          if ("mfaRequired" in result) { router.push("/auth/verify-mfa"); return; }
          await cacheRemoteUser(result.user, password);
          await restoreWorkouts().catch(()=>undefined);
          await restoreLibrary().catch(()=>undefined);
        } catch (reason) {
          if (reason instanceof ServerAuthError) {
            if (reason.status !== 401) throw reason;
            try { await loginLocalUser(username, password); } catch { throw reason; }
          } else {
            await loginLocalUser(username, password);
          }
        }
        showToast("Welcome back. Your training space is ready.");
        router.push("/dashboard");
      }
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not complete sign in. Try again.");
    } finally { setBusy(false); }
  }

  async function handlePasskeyLogin() {
    setError(""); setNotice(""); setBusy(true);
    try {
      const username = String(new FormData(authFormRef.current ?? undefined).get("username") ?? "").trim();
      const optionsResponse = await fetch("/api/auth/passkeys/login/options", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ username }) });
      const optionsBody = await optionsResponse.json().catch(() => ({})) as { options?: Parameters<typeof startAuthentication>[0]["optionsJSON"]; challengeId?: string; error?: string };
      if (!optionsResponse.ok || !optionsBody.options || !optionsBody.challengeId) throw new Error(optionsBody.error ?? "Could not start passkey sign-in.");
      const credential = await startAuthentication({ optionsJSON: optionsBody.options });
      const verifyResponse = await fetch("/api/auth/passkeys/login/verify", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ challengeId: optionsBody.challengeId, response: credential }) });
      const result = await verifyResponse.json().catch(() => ({})) as { user?: Omit<LocalUser, "passwordHash" | "createdAt">; error?: string; mfaRequired?: boolean };
      if (verifyResponse.status === 202 && result.mfaRequired) { router.push("/auth/verify-mfa"); return; }
      if (!verifyResponse.ok || !result.user) throw new Error(result.error ?? "Passkey sign-in failed.");
      await cacheRemoteUser(result.user, crypto.randomUUID());
      await restoreWorkouts().catch(() => undefined); await restoreLibrary().catch(() => undefined);
      showToast("Signed in with your passkey.");
      router.push("/dashboard"); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Passkey sign-in failed. Try your password instead."); }
    finally { setBusy(false); }
  }

  return <main className="auth-shell"><header className="workout-top"><Link className="brand" href="/"><ArcusMark /><span>ARCUS<span className="brand-period">.</span></span></Link><span className="topbar-note">YOUR TRAINING, YOUR DATA</span></header>
    <section className="auth-card"><p className="eyebrow"><span className="live-dot" /> {signup ? "START YOUR TRAINING SPACE" : "WELCOME BACK"}</p><h1>{signup ? <>Make room<br/><span>for progress.</span></> : <>Good to<br/><span>see you.</span></>}</h1><p className="auth-intro">{signup ? "Create an account and keep your training data safely on this device." : "Sign in to your training space."}</p>
      <form ref={authFormRef} className="auth-form" onSubmit={(event) => void handleSubmit(event)}>{signup && <label>Username<input name="username" type="text" autoComplete="username" minLength={3} maxLength={32} pattern="[A-Za-z0-9_]+" required /></label>}{signup && <label>Email for account recovery<input name="email" type="email" autoComplete="email" required /></label>}{signup && <label>Your name<input name="name" type="text" autoComplete="name" maxLength={80} required /></label>}{!signup && <label>Username<input name="username" type="text" autoComplete="username" minLength={3} maxLength={32} required /></label>}<label>Password<input name="password" type="password" minLength={8} autoComplete={signup ? "new-password" : "current-password"} required /></label><button className="action-button auth-submit" disabled={busy}>{busy ? "Working…" : signup ? "Create account" : "Sign in"}<ArrowRight size={16}/></button></form>
      {!signup && <button className="outline-button auth-passkey" type="button" disabled={busy} onClick={() => void handlePasskeyLogin()}><Fingerprint size={17}/> Sign in with a passkey</button>}
      {!signup && <p className="auth-switch"><Link href="/auth/forgot-password">Forgot password?</Link></p>}
      {error && <p role="alert" className="auth-error">{error}</p>}{notice && <p role="status" className="auth-notice">{notice}</p>}
      <p className="auth-switch">{signup ? "Already have an account?" : "New to ARCUS?"} <Link href={signup ? "/login" : "/signup"}>{signup ? "Sign in" : "Create account"}</Link></p>
    </section></main>;
}

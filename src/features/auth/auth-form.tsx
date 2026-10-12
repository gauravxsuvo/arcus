"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Fingerprint, LoaderCircle } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
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
  const [loginStatus, setLoginStatus] = useState<"idle" | "submitting" | "success">("idle");
  const authFormRef = useRef<HTMLFormElement>(null);
  const navigationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reduceMotion = useReducedMotion();
  const signup = mode === "signup";

  useEffect(() => () => { if (navigationTimer.current) clearTimeout(navigationTimer.current); }, []);

  function completeSignIn(message: string) {
    setLoginStatus("success");
    try { if (typeof navigator !== "undefined") navigator.vibrate?.(50); } catch { /* Haptics are optional. */ }
    showToast(message);
    const requestedDestination = new URLSearchParams(window.location.search).get("next");
    let destination = "/home";
    if (requestedDestination) {
      try {
        const candidate = new URL(requestedDestination, window.location.origin);
        if (candidate.origin === window.location.origin) destination = `${candidate.pathname}${candidate.search}${candidate.hash}`;
      } catch { /* Ignore invalid or external redirect targets. */ }
    }
    navigationTimer.current = setTimeout(() => {
      router.push(destination);
    }, 250);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setNotice(""); setBusy(true);
    if (!signup) setLoginStatus("submitting");
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
          if ("mfaRequired" in result) { setLoginStatus("idle"); router.push("/auth/verify-mfa"); return; }
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
        completeSignIn("Welcome back. Your training space is ready.");
      }
      router.refresh();
    } catch (reason) {
      setLoginStatus("idle");
      setError(reason instanceof Error ? reason.message : "Could not complete sign in. Try again.");
    } finally { setBusy(false); }
  }

  async function handlePasskeyLogin() {
    setError(""); setNotice(""); setBusy(true); setLoginStatus("submitting");
    try {
      const username = String(new FormData(authFormRef.current ?? undefined).get("username") ?? "").trim();
      const optionsResponse = await fetch("/api/auth/passkeys/login/options", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ username }) });
      const optionsBody = await optionsResponse.json().catch(() => ({})) as { options?: Parameters<typeof startAuthentication>[0]["optionsJSON"]; challengeId?: string; error?: string };
      if (!optionsResponse.ok || !optionsBody.options || !optionsBody.challengeId) throw new Error(optionsBody.error ?? "Could not start passkey sign-in.");
      const credential = await startAuthentication({ optionsJSON: optionsBody.options });
      const verifyResponse = await fetch("/api/auth/passkeys/login/verify", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ challengeId: optionsBody.challengeId, response: credential }) });
      const result = await verifyResponse.json().catch(() => ({})) as { user?: Omit<LocalUser, "passwordHash" | "createdAt">; error?: string; mfaRequired?: boolean };
      if (verifyResponse.status === 202 && result.mfaRequired) { setLoginStatus("idle"); router.push("/auth/verify-mfa"); return; }
      if (!verifyResponse.ok || !result.user) throw new Error(result.error ?? "Passkey sign-in failed.");
      await cacheRemoteUser(result.user, crypto.randomUUID());
      await restoreWorkouts().catch(() => undefined); await restoreLibrary().catch(() => undefined);
      completeSignIn("Signed in with your passkey.");
    } catch (reason) { setLoginStatus("idle"); setError(reason instanceof Error ? reason.message : "Passkey sign-in failed. Try your password instead."); }
    finally { setBusy(false); }
  }

  const success = loginStatus === "success";
  const cardTransition = reduceMotion
    ? { duration: 0.01 }
    : { duration: 0.35, ease: [0.32, 0.72, 0, 1] as const };

  return <main className="auth-shell"><header className="workout-top"><Link className="brand" href="/"><ArcusMark /><span>ARCUS<span className="brand-period">.</span></span></Link><span className="topbar-note">YOUR TRAINING, YOUR DATA</span></header>
    <motion.section className="auth-card" animate={success ? { opacity: 0, scale: reduceMotion ? 1 : 0.98, y: reduceMotion ? 0 : -8, filter: reduceMotion ? "blur(0px)" : "blur(8px)" } : { opacity: 1, scale: 1, y: 0, filter: "blur(0px)" }} transition={cardTransition}>
      <p className="eyebrow"><span className="live-dot" /> {signup ? "START YOUR TRAINING SPACE" : "WELCOME BACK"}</p><h1>{signup ? <>Make room<br/><span>for progress.</span></> : <>Good to<br/><span>see you.</span></>}</h1><p className="auth-intro">{signup ? "Create an account and keep your training data safely on this device." : "Sign in to your training space."}</p>
      <form ref={authFormRef} className="auth-form" onSubmit={(event) => void handleSubmit(event)}>{signup && <label>Username<input name="username" type="text" autoComplete="username" minLength={3} maxLength={32} pattern="[A-Za-z0-9_]+" required /></label>}{signup && <label>Email for account recovery<input name="email" type="email" autoComplete="email" required /></label>}{signup && <label>Your name<input name="name" type="text" autoComplete="name" maxLength={80} required /></label>}{!signup && <label>Username or Email<input name="username" type="text" autoComplete="username" minLength={3} maxLength={255} required /></label>}<label><div style={{ display:"flex", justifyContent:"space-between" }}><span>Password</span>{!signup && <Link href="/forgot-password" style={{ color:"#a1a1aa", fontSize:"13px" }}>Forgot password?</Link>}</div><input name="password" type="password" minLength={8} autoComplete={signup ? "new-password" : "current-password"} required /></label><motion.button className="action-button auth-submit" data-auth-status={loginStatus} disabled={busy || success} whileTap={reduceMotion ? undefined : { scale: 0.98 }} animate={success ? { backgroundColor: "#166534", color: "#ffffff" } : {}} transition={{ duration: reduceMotion ? 0.01 : 0.18 }}>{loginStatus === "submitting" ? <><LoaderCircle size={16} className="auth-spinner" aria-hidden="true"/>Authenticating…</> : success ? <><Check size={16} aria-hidden="true"/>Welcome back</> : <>{signup ? "Create account" : "Sign in"}<ArrowRight size={16}/></>}</motion.button></form>
      {!signup && <button className="outline-button auth-passkey" type="button" disabled={busy || success} onClick={() => void handlePasskeyLogin()}><Fingerprint size={17}/> Sign in with a passkey</button>}
      {!signup && <p className="auth-switch"><Link href="/auth/forgot-password">Forgot password?</Link></p>}
      {error && <p role="alert" className="auth-error">{error}</p>}{notice && <p role="status" className="auth-notice">{notice}</p>}
      <p className="auth-switch">{signup ? "Already have an account?" : "New to ARCUS?"} <Link href={signup ? "/login" : "/signup"}>{signup ? "Sign in" : "Create account"}</Link></p>
    </motion.section></main>;
}

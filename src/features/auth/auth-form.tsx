"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { cacheRemoteUser, loginLocalUser, registerLocalUser, type LocalUser } from "@/features/local-data/repository";
import { ArcusMark } from "@/components/shared/arcus-mark";
import { restoreLibrary } from "@/features/local-data/sync";
import { restoreWorkouts } from "@/features/workouts/sync";

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
  const payload = await response.json().catch(() => ({})) as { user?: Omit<LocalUser, "passwordHash" | "createdAt">; error?: string };
  if (!response.ok || !payload.user) throw new ServerAuthError(payload.error ?? "Could not complete account request.", response.status);
  return payload.user;
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
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
          const user = await requestServerAuth("/api/auth/signup", { username, email, password, name });
          await cacheRemoteUser(user, password);
          await restoreWorkouts().catch(()=>undefined);
          await restoreLibrary().catch(()=>undefined);
        } catch (reason) {
          if (reason instanceof ServerAuthError) throw reason;
          await registerLocalUser({ username, email, password, name });
        }
        router.push("/onboarding");
      } else {
        try {
          const user = await requestServerAuth("/api/auth/login", { username, password });
          await cacheRemoteUser(user, password);
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
        router.push("/dashboard");
      }
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not complete sign in. Try again.");
    } finally { setBusy(false); }
  }

  return <main className="auth-shell"><header className="workout-top"><Link className="brand" href="/"><ArcusMark /><span>ARCUS<span className="brand-period">.</span></span></Link><span className="topbar-note">YOUR TRAINING, YOUR DATA</span></header>
    <section className="auth-card"><p className="eyebrow"><span className="live-dot" /> {signup ? "START YOUR TRAINING SPACE" : "WELCOME BACK"}</p><h1>{signup ? <>Make room<br/><span>for progress.</span></> : <>Good to<br/><span>see you.</span></>}</h1><p className="auth-intro">{signup ? "Create an account and keep your training data safely on this device." : "Sign in to your training space."}</p>
      <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>{signup && <label>Username<input name="username" type="text" autoComplete="username" minLength={3} maxLength={32} pattern="[A-Za-z0-9_]+" required /></label>}{signup && <label>Email for account recovery<input name="email" type="email" autoComplete="email" required /></label>}{signup && <label>Your name<input name="name" type="text" autoComplete="name" maxLength={80} required /></label>}{!signup && <label>Username or Email<input name="username" type="text" autoComplete="username" minLength={3} maxLength={255} required /></label>}<label><div style={{ display:"flex", justifyContent:"space-between" }}><span>Password</span>{!signup && <Link href="/forgot-password" style={{ color:"#a1a1aa", fontSize:"13px" }}>Forgot password?</Link>}</div><input name="password" type="password" minLength={8} autoComplete={signup ? "new-password" : "current-password"} required /></label><button className="action-button auth-submit" disabled={busy}>{busy ? "Working…" : signup ? "Create account" : "Sign in"}<ArrowRight size={16}/></button></form>
      {error && <p role="alert" className="auth-error">{error}</p>}{notice && <p role="status" className="auth-notice">{notice}</p>}
      <p className="auth-switch">{signup ? "Already have an account?" : "New to ARCUS?"} <Link href={signup ? "/login" : "/signup"}>{signup ? "Sign in" : "Create account"}</Link></p>
    </section></main>;
}

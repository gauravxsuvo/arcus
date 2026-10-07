"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

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
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    try {
      const supabase = createSupabaseBrowserClient();
      if (signup) {
        const { data, error: authError } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
        if (authError) throw authError;
        if (!data.session) {
          setNotice("Check your inbox to confirm your account, then come back to sign in.");
          return;
        }
        router.push("/onboarding");
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        router.push("/dashboard");
      }
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not complete sign in. Try again.");
    } finally { setBusy(false); }
  }

  return <main className="auth-shell"><header className="workout-top"><Link className="brand" href="/"><span className="brand-mark">F</span><span>FORGE<span className="brand-period">.</span></span></Link><span className="topbar-note">YOUR TRAINING, YOUR DATA</span></header>
    <section className="auth-card"><p className="eyebrow"><span className="live-dot" /> {signup ? "START YOUR TRAINING SPACE" : "WELCOME BACK"}</p><h1>{signup ? <>Make room<br/><span>for progress.</span></> : <>Good to<br/><span>see you.</span></>}</h1><p className="auth-intro">{signup ? "Create an account to set up your training profile and sync across devices." : "Sign in to your training space."}</p>
      <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>{signup && <label>Your name<input name="name" type="text" autoComplete="name" maxLength={80} required /></label>}<label>Email<input name="email" type="email" autoComplete="email" required /></label><label>Password<input name="password" type="password" minLength={8} autoComplete={signup ? "new-password" : "current-password"} required /></label><button className="action-button auth-submit" disabled={busy}>{busy ? "Working…" : signup ? "Create account" : "Sign in"}<ArrowRight size={16}/></button></form>
      {error && <p role="alert" className="auth-error">{error}</p>}{notice && <p role="status" className="auth-notice">{notice}</p>}
      <p className="auth-switch">{signup ? "Already have an account?" : "New to Forge?"} <Link href={signup ? "/login" : "/signup"}>{signup ? "Sign in" : "Create account"}</Link></p>
    </section></main>;
}

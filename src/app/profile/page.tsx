"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, LogOut, UserRound } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Profile = { display_name: string | null; experience: string | null; goals: string[]; height_cm: number | null };

export default function ProfilePage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    try {
      void (async () => {
        const supabase = createSupabaseBrowserClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!user) { if (!cancelled) setReady(true); return; }
        const { data, error: profileError } = await supabase.from("profiles").select("display_name,experience,goals,height_cm").eq("id", user.id).maybeSingle();
        if (profileError) throw profileError;
        if (!cancelled) { setEmail(user.email ?? ""); setProfile(data); setReady(true); }
      })().catch((reason: unknown) => { if (!cancelled) { setError(reason instanceof Error ? reason.message : "Could not load your profile."); setReady(true); } });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Supabase is not configured."); setReady(true); }
    return () => { cancelled = true; };
  }, []);

  async function signOut() {
    try {
      const { error: signOutError } = await createSupabaseBrowserClient().auth.signOut();
      if (signOutError) throw signOutError;
      router.push("/"); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not sign out."); }
  }

  return <main className="workout-shell"><header className="workout-top"><Link className="back-link" href="/dashboard"><ArrowLeft size={17}/> Dashboard</Link><Link className="offline-badge" href="/onboarding">EDIT TRAINING PROFILE <ArrowRight size={13}/></Link></header><section className="history-heading"><p className="eyebrow"><span className="live-dot"/> ACCOUNT & PREFERENCES</p><h1>Your space<span>.</span></h1></section>
    {!ready ? <div className="loading-block">Loading account…</div> : profile ? <section className="profile-panel"><div className="profile-avatar"><UserRound size={25}/></div><div className="profile-name"><h2>{profile.display_name || "Athlete"}</h2><p>{email}</p></div><div className="profile-facts"><div><span>EXPERIENCE</span><strong>{profile.experience || "Not set"}</strong></div><div><span>HEIGHT</span><strong>{profile.height_cm ? `${profile.height_cm} cm` : "Not set"}</strong></div><div><span>GOALS</span><strong>{profile.goals?.length ? profile.goals.join(", ") : "Not set"}</strong></div></div><button className="cancel-workout profile-signout" onClick={() => void signOut()}><LogOut size={15}/> Sign out</button></section> : <section className="empty-exercises profile-empty"><div className="empty-mark"><UserRound size={22}/></div><h3>Sign in to set up your profile.</h3><p>Your current workout logging remains saved on this device.</p><div className="profile-actions"><Link className="action-button" href="/login">Sign in <ArrowRight size={15}/></Link><Link className="outline-button" href="/signup">Create account</Link></div></section>}
    {error && <p role="alert" className="auth-error">{error}</p>}
  </main>;
}

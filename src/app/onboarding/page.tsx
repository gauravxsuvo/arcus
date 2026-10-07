"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const goalOptions = ["Muscle gain", "Strength", "Fat loss", "General fitness", "Bodybuilding", "Powerlifting", "Athletic performance"];
const equipmentOptions = ["Barbell", "Dumbbell", "Cable", "Machines", "Bodyweight"];

export default function OnboardingPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [goals, setGoals] = useState<string[]>([]);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    try {
      void createSupabaseBrowserClient().auth.getUser().then(({ data }) => {
        if (cancelled) return;
        if (!data.user) router.replace("/login");
        else setAuthorized(true);
      }).catch(() => { if (!cancelled) setError("Could not verify your session. Check your connection and try again."); });
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Supabase is not configured."); }
    return () => { cancelled = true; };
  }, [router]);

  function toggle(value: string, values: string[], update: (next: string[]) => void) {
    update(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    const days = Number(form.get("days"));
    const duration = Number(form.get("duration"));
    if (!Number.isInteger(days) || days < 1 || days > 7 || !Number.isInteger(duration) || duration < 15 || duration > 240) {
      setError("Choose 1–7 training days and a 15–240 minute session length."); setBusy(false); return;
    }
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw userError ?? new Error("Sign in to save your profile.");
      const { error: updateError } = await supabase.from("profiles").update({
        display_name: String(form.get("name") ?? "").trim() || null,
        experience: String(form.get("experience") ?? "beginner"),
        sex: String(form.get("sex") ?? "") || null,
        height_cm: form.get("height") ? Number(form.get("height")) : null,
        goals,
        preferences: {
          age: form.get("age") ? Number(form.get("age")) : null,
          training_days: days,
          session_minutes: duration,
          equipment,
          preferred_exercises: String(form.get("preferred") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
          disliked_exercises: String(form.get("disliked") ?? "").split(",").map((value) => value.trim()).filter(Boolean),
        },
      }).eq("id", user.id);
      if (updateError) throw updateError;
      router.push("/dashboard"); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save your training profile."); }
    finally { setBusy(false); }
  }

  return <main className="auth-shell onboarding-shell"><header className="workout-top"><Link className="back-link" href="/dashboard"><ArrowLeft size={17}/> Back</Link><span className="offline-badge">PROFILE SETUP · OPTIONAL FIELDS</span></header><section className="onboarding-card"><p className="eyebrow"><span className="live-dot"/> YOUR STARTING POINT</p><h1>Set your<br/><span>own terms.</span></h1><p className="auth-intro">Share only what’s useful. You can change these details later.</p>
    <form className="onboarding-form" onSubmit={(event) => void handleSubmit(event)}>
      <div className="form-section"><h2>About you <span>OPTIONAL</span></h2><div className="form-grid"><label>Name<input name="name" autoComplete="name" maxLength={80}/></label><label>Age<input name="age" type="number" min="13" max="110" inputMode="numeric"/></label><label>Height · cm<input name="height" type="number" min="80" max="250" step="0.1" inputMode="decimal"/></label><label>Sex<select name="sex" defaultValue=""><option value="">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></select></label></div></div>
      <div className="form-section"><h2>Training experience</h2><label className="full-label">Choose the level that feels right<select name="experience" defaultValue="beginner"><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="advanced">Advanced</option></select></label></div>
      <div className="form-section"><h2>Your goals <span>SELECT ANY</span></h2><div className="choice-grid">{goalOptions.map((goal) => <button type="button" className={`choice-chip ${goals.includes(goal) ? "choice-selected" : ""}`} key={goal} onClick={() => toggle(goal, goals, setGoals)}>{goal}{goals.includes(goal) && <Check size={13}/>}</button>)}</div></div>
      <div className="form-section"><h2>Your routine</h2><div className="form-grid"><label>Training days / week<input name="days" type="number" min="1" max="7" defaultValue="3" required/></label><label>Typical session · min<input name="duration" type="number" min="15" max="240" step="5" defaultValue="60" required/></label></div><p className="field-caption">Equipment you can use</p><div className="choice-grid">{equipmentOptions.map((item) => <button type="button" className={`choice-chip ${equipment.includes(item) ? "choice-selected" : ""}`} key={item} onClick={() => toggle(item, equipment, setEquipment)}>{item}{equipment.includes(item) && <Check size={13}/>}</button>)}</div><div className="form-grid preference-inputs"><label>Exercises you enjoy<input name="preferred" placeholder="e.g. squat, row, pull-up"/></label><label>Exercises you avoid<input name="disliked" placeholder="e.g. burpee, running"/></label></div></div>
      {error && <p role="alert" className="auth-error">{error}</p>}<button className="action-button auth-submit" disabled={busy || !authorized}>{busy ? "Saving…" : "Save training profile"}<ArrowRight size={16}/></button>
    </form></section></main>;
}

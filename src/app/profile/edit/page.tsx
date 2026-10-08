"use client";

import { NumericInput } from "@/components/shared/numeric-input";
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ImagePlus } from "lucide-react";
import { AvatarCropper } from "@/components/profile/avatar-cropper";
import { getLocalSession, type LocalUser, updateLocalUser } from "@/features/local-data/repository";
import { ProfileFields } from "@/components/profile/profile-fields";
import { profileDetailsSchema } from "@/features/profile/schema";
import { dateKey } from "@/features/training/logic";
import type { UserProfile } from "@/features/profile/model";

export default function EditProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<LocalUser | null>(null);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [details,setDetails]=useState<UserProfile|null>(null);
  const [cropSource, setCropSource] = useState<string | null>(null);
  const cropObjectUrl = useRef<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getLocalSession().then((session) => {
      if (cancelled) return;
      if (!session) router.replace("/login");
      else { setUser(session); setDetails(session.profile); setAvatar(session.profile.avatarUrl ?? null); setAuthorized(true); }
    }).catch((reason: unknown) => { if (!cancelled) setError(reason instanceof Error ? reason.message : "Could not load your profile."); });
    return () => { cancelled = true; };
  }, [router]);

  useEffect(() => () => {
    if (cropObjectUrl.current) URL.revokeObjectURL(cropObjectUrl.current);
  }, []);

  function closeCropper() {
    if (cropObjectUrl.current) URL.revokeObjectURL(cropObjectUrl.current);
    cropObjectUrl.current = null;
    setCropSource(null);
  }

  function chooseAvatar(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Choose an image file."); return; }
    if (file.size > 20 * 1024 * 1024) { setError("Choose an image smaller than 20 MB."); return; }
    if (cropObjectUrl.current) URL.revokeObjectURL(cropObjectUrl.current);
    cropObjectUrl.current = URL.createObjectURL(file);
    setCropSource(cropObjectUrl.current);
    setError("");
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setError(""); setBusy(true);
    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") ?? "").trim().toLowerCase();
    const name = String(form.get("name") ?? "").trim();
    const bio = String(form.get("bio") ?? "").trim().slice(0, 160);
    const goals = String(form.get("goals") ?? "").split(",").map((item) => item.trim()).filter(Boolean).slice(0, 8);
    const ageValue = Number(form.get("age"));
    if (!/^[A-Za-z0-9_]{3,32}$/.test(username)) { setError("Username must be 3–32 letters, numbers, or underscores."); setBusy(false); return; }
    if (!name || name.length > 80) { setError("Enter a display name up to 80 characters."); setBusy(false); return; }
    const snapshot=details?.bodyMetrics?.weight?{id:crypto.randomUUID(),date:dateKey(new Date()),weight:details.bodyMetrics.weight,bodyFat:details.bodyMetrics.bodyFat}:null;
    const profile = { ...user.profile, ...details, bodyMetricsHistory:[...(details?.bodyMetricsHistory??[]),...(snapshot?[snapshot]:[])].slice(-1500), bio: bio || null, avatarUrl: avatar, age: Number.isFinite(ageValue) && ageValue > 0 ? ageValue : null, sex: String(form.get("sex") ?? "") || null, experience: String(form.get("experience") ?? "") || null, goals };
    const profileData={preferences:profile.preferences,bodyMetrics:profile.bodyMetrics,bodyMetricsHistory:profile.bodyMetricsHistory,dateOfBirth:profile.dateOfBirth,targetGoals:profile.targetGoals,activeProgram:profile.activeProgram};
    const validated=profileDetailsSchema.safeParse(profileData);
    if(!validated.success){setError(validated.error.issues[0]?.message??"Check your settings.");setBusy(false);return;}
    const updated = { ...user, username, name, profile, syncStatus:"pending" as const, updatedAt:new Date().toISOString() };
    try {
      await updateLocalUser(updated);
      let savedToAccount = false;
      let cloudUnavailable = false;
      try {
        const response = await fetch("/api/auth/profile", { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ username, name, bio, goals, experience: profile.experience, height_cm: profile.height_cm, avatarUrl: avatar, profileData }) });
        if (response.ok) {
          const payload = await response.json() as { user: { username: string; name: string; profile: LocalUser["profile"] } };
          await updateLocalUser({ ...updated, syncStatus:"synced", username: payload.user.username, name: payload.user.name, profile: { ...profile, ...payload.user.profile } });
          savedToAccount = true;
        }
        else if (response.status === 401 || response.status === 503) cloudUnavailable = true;
        else {
          const payload = await response.json().catch(() => ({})) as { error?: string };
          await updateLocalUser(user);
          throw new Error(payload.error ?? "Could not update your profile.");
        }
      } catch (reason) {
        if (!(reason instanceof TypeError)) throw reason;
        cloudUnavailable = true;
      }
      const destination=`/profile?saved=${savedToAccount ? "account" : "device"}${cloudUnavailable ? "&sync=unavailable" : ""}`;
      if(!navigator.onLine&&navigator.serviceWorker?.controller)window.location.assign(destination);
      else {router.push(destination);router.refresh();}
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not save your profile."); }
    finally { setBusy(false); }
  }

  if (!user) return <main className="auth-shell"><div className="social-empty">{error || "Loading your profile…"}</div></main>;
  const profile = user.profile;

  return <main className="auth-shell profile-edit-shell">
    {cropSource && <AvatarCropper src={cropSource} onCancel={closeCropper} onApply={(cropped) => { setAvatar(cropped); closeCropper(); setError(""); }} onError={(message) => { setError(message); closeCropper(); }} />}
    <header className="workout-top"><Link className="back-link" href="/profile"><ArrowLeft size={17}/> Back to profile</Link><span className="offline-badge">PROFILE EDITOR</span></header>
    <section className="profile-edit-card">
      <div className="profile-edit-heading"><div><p className="social-kicker"><span className="social-live-dot"/> PERSONALIZE YOUR SPACE</p><h1>Make it yours<span>.</span></h1><p>Update how your training profile appears to you and your friends.</p></div></div>
      <form className="profile-edit-form" onSubmit={(event) => void saveProfile(event)}>
        <div className="profile-avatar-editor"><label className="profile-edit-avatar" aria-label="Choose profile photo">{avatar ? <Image src={avatar} alt="" width={120} height={120} sizes="120px" unoptimized/> : <span>{user.name.split(/\s+/).slice(0,2).map(s=>s.charAt(0).toUpperCase()).join("")}</span>}<input className="visually-hidden" type="file" accept="image/*" onChange={chooseAvatar}/></label><div><label className="upload-avatar-button"><ImagePlus size={16}/> Change photo<input type="file" accept="image/*" onChange={(event) => chooseAvatar(event)} /></label><button type="button" className="remove-avatar-button" onClick={() => setAvatar(null)} disabled={!avatar}>Remove photo</button><small>Crop your photo, then save it to your account</small></div></div>
        {details && <ProfileFields profile={details} onChange={setDetails}/>}<div className="profile-form-section"><h2>Identity</h2><div className="profile-form-grid"><label>Username<input name="username" defaultValue={user.username} autoComplete="username" maxLength={32} required /></label><label>Display name<input name="name" defaultValue={user.name} autoComplete="name" maxLength={80} required /></label><label className="profile-form-wide">Bio<textarea name="bio" defaultValue={profile.bio ?? ""} maxLength={160} placeholder="What are you training for?" rows={3}></textarea><small>160 characters max</small></label></div></div>
        <div className="profile-form-section"><h2>About you</h2><div className="profile-form-grid"><label>Age<NumericInput name="age" min="13" max="110" defaultValue={profile.age ?? ""} inputMode="numeric" /></label><label>Sex<select name="sex" defaultValue={profile.sex ?? ""}><option value="">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option><option value="other">Other</option></select></label></div><p className="profile-privacy-note">Age and sex stay on this device. Your photo, height, and experience sync to your account.</p></div>
        <div className="profile-form-section"><h2>Goals</h2><label className="profile-form-wide">Separate goals with commas<input name="goals" defaultValue={profile.goals.join(", ")} placeholder="Strength, muscle gain, consistency" /></label></div>
        {error && <p className="auth-error" role="alert">{error}</p>}
        <div className="profile-edit-actions"><Link className="outline-button" href="/profile">Cancel</Link><button className="action-button" type="submit" disabled={busy || !authorized}>{busy ? "Saving…" : "Save profile"}{busy ? null : <Check size={16}/>}</button></div>
      </form>
    </section>
  </main>;
}

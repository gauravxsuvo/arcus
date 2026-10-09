"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, KeyRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { ArcusMark } from "@/components/shared/arcus-mark";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [step, setStep] = useState<"email" | "reset">("email");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    
    if (step === "email") {
      if (!email) {
        setError("Please enter your email or username.");
        return;
      }
      setStep("reset");
      return;
    }
    
    if (!code || !newPassword) {
      setError("Please enter the MFA code and your new password.");
      return;
    }
    
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset password.");
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <header className="workout-top">
        <Link className="brand" href="/">
          <ArcusMark /><span>ARCUS<span className="brand-period">.</span></span>
        </Link>
        <span className="topbar-note">ACCOUNT RECOVERY</span>
      </header>
      
      <section className="auth-card">
        {success ? (
          <div style={{ textAlign: "center" }}>
            <KeyRound size={48} color="#4ade80" style={{ margin: "0 auto 16px" }} />
            <h1>Password reset</h1>
            <p className="auth-intro" style={{ marginTop: "12px", marginBottom: "24px" }}>
              Your password has been successfully changed.
            </p>
            <Link href="/login" className="action-button" style={{ justifyContent: "center" }}>
              Sign in to Arcus <ArrowRight size={16}/>
            </Link>
          </div>
        ) : (
          <>
            <p className="eyebrow"><span className="live-dot" /> FORGOT PASSWORD</p>
            <h1>Reset your<br/><span>password.</span></h1>
            <p className="auth-intro">
              {step === "email" 
                ? "Enter your email address or username to begin." 
                : "Enter the 6-digit code from your authenticator app to authorize the password reset."}
            </p>
            
            <form className="auth-form" onSubmit={handleReset}>
              {step === "email" ? (
                <label>
                  Username or Email
                  <input type="text" value={email} onChange={e => setEmail(e.target.value)} required autoComplete="username" />
                </label>
              ) : (
                <>
                  <label>
                    Authenticator Code (MFA)
                    <input type="text" value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" pattern="[0-9]*" maxLength={6} required placeholder="000000" style={{ letterSpacing: "4px", fontSize: "16px" }} />
                  </label>
                  <label>
                    New Password
                    <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} minLength={8} required autoComplete="new-password" />
                  </label>
                </>
              )}
              
              <button className="action-button auth-submit" disabled={busy}>
                {busy ? "Working…" : step === "email" ? "Continue" : "Reset Password"}
                <ArrowRight size={16}/>
              </button>
            </form>
            
            {error && <p role="alert" className="auth-error">{error}</p>}
            
            <p className="auth-switch">
              <Link href="/login"><ArrowLeft size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: "4px" }}/> Back to sign in</Link>
            </p>
          </>
        )}
      </section>
    </main>
  );
}

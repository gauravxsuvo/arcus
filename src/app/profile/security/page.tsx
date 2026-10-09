"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, QrCode } from "lucide-react";
import { useProfile } from "@/components/shared/user-profile-provider";

export default function SecurityPage() {
  const { user } = useProfile();
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState(false);

  async function beginSetup() {
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/mfa/setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to setup MFA.");
      setSecret(data.secret);
      setQrCodeUrl(data.qrCodeDataUrl);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function verifySetup(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !secret) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, secret }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Invalid code.");
      setSuccess(true);
      setQrCodeUrl(null);
      setSecret(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell profile-edit-shell">
      <header className="workout-top">
        <Link className="back-link" href="/profile">
          <ArrowLeft size={17} /> Back to profile
        </Link>
        <span className="offline-badge">SECURITY</span>
      </header>
      <section className="profile-edit-card" style={{ maxWidth: "500px", margin: "20px auto" }}>
        <div className="profile-edit-heading">
          <div>
            <p className="social-kicker">
              <span className="social-live-dot" /> TWO-FACTOR AUTHENTICATION
            </p>
            <h1>Protect your account<span>.</span></h1>
            <p>Use an authenticator app (like Google Authenticator) to secure your account and recover your password.</p>
          </div>
        </div>

        {success ? (
          <div className="feature-panel" style={{ textAlign: "center", padding: "40px 20px" }}>
            <ShieldCheck size={48} color="#4ade80" style={{ margin: "0 auto 16px" }} />
            <h2>MFA is Active!</h2>
            <p style={{ marginTop: "12px", color: "#a1a1aa" }}>
              Your account is now protected. You can use your authenticator app to reset your password if you ever forget it.
            </p>
          </div>
        ) : qrCodeUrl ? (
          <form className="profile-edit-form" onSubmit={verifySetup}>
            <div className="feature-panel" style={{ textAlign: "center" }}>
              <h2 style={{ marginBottom: "16px" }}>Scan this QR Code</h2>
              <Image src={qrCodeUrl} alt="MFA QR Code" width={200} height={200} style={{ margin: "0 auto", borderRadius: "8px" }} unoptimized />
              <p style={{ marginTop: "16px", color: "#a1a1aa", fontSize: "14px" }}>Or enter this code manually:<br/><strong style={{ color: "#fff", letterSpacing: "2px" }}>{secret}</strong></p>
            </div>
            
            <div className="profile-form-section" style={{ marginTop: "24px" }}>
              <label>
                Enter the 6-digit code from your app
                <input type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6} value={token} onChange={e => setToken(e.target.value)} placeholder="000000" required style={{ letterSpacing: "4px", fontSize: "18px", textAlign: "center" }} />
              </label>
            </div>
            
            {error && <p className="auth-error" role="alert">{error}</p>}
            
            <div className="profile-edit-actions">
              <button className="outline-button" type="button" onClick={() => setQrCodeUrl(null)}>Cancel</button>
              <button className="action-button" type="submit" disabled={busy || token.length < 6}>
                {busy ? "Verifying..." : "Verify & Enable"}
              </button>
            </div>
          </form>
        ) : (
          <div className="profile-edit-form">
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button className="action-button" type="button" onClick={beginSetup} disabled={busy} style={{ width: "100%", justifyContent: "center" }}>
              <QrCode size={18} style={{ marginRight: "8px" }} /> {busy ? "Loading..." : "Setup Authenticator App"}
            </button>
          </div>
        )}
      </section>
    </main>
  );
}

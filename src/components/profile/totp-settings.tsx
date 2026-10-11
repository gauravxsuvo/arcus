"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Check, Copy, KeyRound, ShieldCheck, ShieldOff } from "lucide-react";

type Setup = { qrCode: string; manualKey: string; expiresInSeconds: number };

async function request<T>(url: string, method = "GET", body?: Record<string, string>) {
  const response = await fetch(url, { method, credentials: "include", cache: "no-store", ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Security settings are unavailable.");
  return payload;
}

export function TotpSettings() {
  const [enabled, setEnabled] = useState(false);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { void request<{ enabled: boolean }>("/api/auth/mfa/setup").then(({ enabled: value }) => setEnabled(value)).catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Could not load security settings.")); }, []);

  async function startSetup() {
    setBusy(true); setMessage("");
    try { setSetup(await request<Setup>("/api/auth/mfa/setup", "POST")); setCode(""); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not start authenticator setup."); }
    finally { setBusy(false); }
  }

  async function enable() {
    setBusy(true); setMessage("");
    try {
      const result = await request<{ enabled: boolean; backupCodes: string[] }>("/api/auth/mfa/setup", "PUT", { code });
      setEnabled(result.enabled); setBackupCodes(result.backupCodes); setSetup(null); setCode("");
      setMessage("Two-factor authentication is on. Save these recovery codes somewhere safe.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not verify that code."); }
    finally { setBusy(false); }
  }

  async function disable() {
    setBusy(true); setMessage("");
    try { await request("/api/auth/mfa/disable", "POST", { code }); setEnabled(false); setCode(""); setBackupCodes([]); setMessage("Two-factor authentication is off."); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not disable two-factor authentication."); }
    finally { setBusy(false); }
  }

  async function copyCodes() {
    await navigator.clipboard.writeText(backupCodes.join("\n"));
    setMessage("Recovery codes copied. Store them somewhere private.");
  }

  return <section className="feature-panel totp-settings">
    <div className="panel-heading"><div><p className="eyebrow">ACCOUNT SECURITY</p><h2>Authenticator app</h2></div>{enabled ? <ShieldCheck size={20} className="panel-icon"/> : <KeyRound size={20} className="panel-icon"/>}</div>
    <p>Add a six-digit code from Google Authenticator, 1Password, or another TOTP app when you sign in. ARCUS never stores the authenticator key in plain text.</p>
    {!enabled && !setup && <button className="outline-button" type="button" disabled={busy} onClick={() => void startSetup()}>{busy ? "Starting…" : "Set up two-factor authentication"}</button>}
    {setup && !enabled && <div className="totp-enrollment"><Image src={setup.qrCode} alt="QR code for ARCUS authenticator setup" width={192} height={192} unoptimized/><p>Scan this code in your authenticator app. Setup expires in 10 minutes.</p><details><summary>Enter setup key manually</summary><code>{setup.manualKey}</code><button className="outline-button" type="button" onClick={() => void navigator.clipboard.writeText(setup.manualKey)}>Copy setup key</button></details><label>Six-digit authenticator code<input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" maxLength={6}/></label><button className="action-button" type="button" disabled={busy || code.length !== 6} onClick={() => void enable()}>{busy ? "Verifying…" : "Verify and turn on"}<Check size={16}/></button></div>}
    {enabled && <div className="totp-disable"><p><Check size={16}/> Two-factor authentication is enabled.</p><label>Enter an authenticator or recovery code to turn it off<input value={code} onChange={(event) => setCode(event.target.value.trim().slice(0, 40))} inputMode="numeric" autoComplete="one-time-code"/></label><button className="outline-button" type="button" disabled={busy || !code} onClick={() => void disable()}>{busy ? "Verifying…" : "Turn off two-factor authentication"}<ShieldOff size={16}/></button></div>}
    {backupCodes.length > 0 && <div className="totp-backup"><h3>Recovery codes · shown once</h3><p>Each code works one time. Save them in a password manager or another private place.</p><div className="totp-code-grid">{backupCodes.map((item) => <code key={item}>{item}</code>)}</div><button className="outline-button" type="button" onClick={() => void copyCodes()}><Copy size={15}/> Copy recovery codes</button></div>}
    {message && <p className="totp-message" role="status">{message}</p>}
  </section>;
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Fingerprint, Plus, Trash2 } from "lucide-react";
import { startRegistration } from "@simplewebauthn/browser";
import { useProfile } from "@/components/shared/user-profile-provider";

type Passkey = { id: string; createdAt: string; lastUsedAt: string | null; deviceType: string; backedUp: boolean };

async function responseJson<T>(response: Response) {
  const body = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? "Passkey request failed.");
  return body;
}

export function PasskeySettings() {
  const { user } = useProfile();
  const [items, setItems] = useState<Passkey[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const body = await responseJson<{ passkeys?: Passkey[] }>(await fetch("/api/auth/passkeys", { credentials: "include", cache: "no-store" }));
    setItems(body.passkeys ?? []);
  }, []);

  useEffect(() => {
    if (user?.syncStatus === "synced") void refresh().catch((error: unknown) => setMessage(error instanceof Error ? error.message : "Could not load passkeys."));
  }, [user?.id, user?.syncStatus, refresh]);

  if (!user) return null;
  if (user.syncStatus !== "synced") return <section className="feature-panel"><p className="eyebrow">ACCOUNT SECURITY</p><h2>Passkeys</h2><p>Sign in to your online ARCUS account to add a passkey. Local-only profiles can’t use server passkeys yet.</p></section>;

  async function addPasskey() {
    setBusy(true); setMessage("");
    try {
      const options = await responseJson<{ options: Parameters<typeof startRegistration>[0]["optionsJSON"]; challengeId: string }>(await fetch("/api/auth/passkeys/register/options", { method: "POST", credentials: "include" }));
      const credential = await startRegistration({ optionsJSON: options.options });
      await responseJson<{ registered: boolean }>(await fetch("/api/auth/passkeys/register/verify", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ challengeId: options.challengeId, response: credential }) }));
      await refresh(); setMessage("Passkey added. You can now use it on this device.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not add this passkey."); }
    finally { setBusy(false); }
  }

  async function removePasskey(id: string) {
    setBusy(true); setMessage("");
    try {
      await responseJson<{ removed: boolean }>(await fetch("/api/auth/passkeys", { method: "DELETE", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify({ id }) }));
      await refresh(); setMessage("Passkey removed.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not remove this passkey."); }
    finally { setBusy(false); }
  }

  return <section className="feature-panel passkey-settings"><div className="panel-heading"><div><p className="eyebrow">ACCOUNT SECURITY</p><h2>Passkeys</h2></div><Fingerprint size={20} className="panel-icon"/></div><p>Use Face ID, Touch ID, Windows Hello, or your device security key to sign in without a password.</p>
    {items.length > 0 && <div className="passkey-list">{items.map((item) => <article className="passkey-row" key={item.id}><span><Fingerprint size={17}/></span><div><strong>{item.deviceType === "multiDevice" ? "Synced passkey" : "Device passkey"}</strong><small>Added {new Date(item.createdAt).toLocaleDateString()}{item.lastUsedAt ? ` · Used ${new Date(item.lastUsedAt).toLocaleDateString()}` : ""}</small></div><button className="icon-button remove-button" type="button" disabled={busy} aria-label="Remove passkey" onClick={() => void removePasskey(item.id)}><Trash2 size={16}/></button></article>)}</div>}
    <button className="outline-button" type="button" disabled={busy} onClick={() => void addPasskey()}>{busy ? "Working…" : <><Plus size={15}/> Add a passkey</>}</button>{message && <p role="status">{message}</p>}
  </section>;
}

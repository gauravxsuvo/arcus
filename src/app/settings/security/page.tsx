import Link from "next/link";
import { getCurrentAccount } from "@/lib/auth/server";
import { TotpSettings } from "@/components/profile/totp-settings";
import { PasskeySettings } from "@/components/profile/passkey-settings";

export const metadata = { title: "Account security · ARCUS", description: "Manage authenticator app two-factor authentication for your ARCUS account." };

export default async function SecuritySettingsPage() {
  const account = await getCurrentAccount();
  if (!account) return <main className="social-shell security-settings-shell"><header className="activity-heading"><div><p className="social-kicker">ACCOUNT SETTINGS</p><h1>Security &amp; privacy</h1></div><Link href="/settings">Back to settings</Link></header><section className="feature-panel"><h2>Sign in to manage account security</h2><p className="security-settings-intro">Passkeys and two-factor authentication are available after you sign in to your ARCUS account.</p><Link className="action-button" href="/login?next=%2Fsettings%2Fsecurity">Sign in</Link></section></main>;
  return <main className="social-shell security-settings-shell"><header className="activity-heading"><div><p className="social-kicker">ACCOUNT SETTINGS</p><h1>Security</h1></div><Link href="/settings">Back to settings</Link></header><p className="security-settings-intro">Manage the ways you prove it’s you when signing in.</p><PasskeySettings/><TotpSettings/></main>;
}

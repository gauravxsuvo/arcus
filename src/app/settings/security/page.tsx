import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentAccount } from "@/lib/auth/server";
import { TotpSettings } from "@/components/profile/totp-settings";

export const metadata = { title: "Account security · ARCUS", description: "Manage authenticator app two-factor authentication for your ARCUS account." };

export default async function SecuritySettingsPage() {
  const account = await getCurrentAccount();
  if (!account) redirect("/login?next=%2Fsettings%2Fsecurity");
  return <main className="social-shell security-settings-shell"><header className="activity-heading"><div><p className="social-kicker">ACCOUNT SETTINGS</p><h1>Security</h1></div><Link href="/profile">Back to profile</Link></header><p className="security-settings-intro">Protect sign-in with a rotating authenticator code and one-time recovery codes.</p><TotpSettings/></main>;
}

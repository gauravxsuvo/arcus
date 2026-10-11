import { ResetPasswordForm } from "@/components/auth/password-recovery-form";

export const metadata = { title: "Reset password · ARCUS", robots: { index: false, follow: false } };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return token ? <ResetPasswordForm token={token}/> : <main className="auth-shell"><section className="auth-card"><h1>Reset link<br/><span>missing.</span></h1><p className="auth-intro">Request a new password reset link to continue.</p></section></main>;
}

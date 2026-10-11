import { MfaChallengeForm } from "@/components/auth/mfa-challenge-form";

export const metadata = { title: "Verify sign-in · ARCUS", robots: { index: false, follow: false } };

export default function VerifyMfaPage() { return <MfaChallengeForm/>; }

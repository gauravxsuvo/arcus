import "server-only";

export async function sendPasswordResetEmail(email: string, url: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.AUTH_EMAIL_FROM?.trim();
  if (!apiKey || !from) throw new Error("Password reset email is not configured. Set RESEND_API_KEY and AUTH_EMAIL_FROM.");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Reset your ARCUS password",
      text: `A password reset was requested for your ARCUS account. This link expires in 15 minutes.\n\n${url}\n\nIf you did not request this, you can ignore this email.`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Password reset email delivery failed (${response.status}).`);
}

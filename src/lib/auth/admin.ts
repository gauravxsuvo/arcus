import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { getCurrentAccount, getCurrentAccountFromRequest } from "./server";
import { canAccessAdmin, isAdminConfigured, matchesDelegatedAdmin } from "@/features/admin/access";
import { getDatabasePool } from "@/lib/db/pool";

// React cache only deduplicates this lookup within one server render. It is not
// an authorization cache shared across visitors or requests.
const getAdminAccount = cache(async () => {
  const config = { email: process.env.ARCUS_ADMIN_EMAIL, accountId: process.env.ARCUS_ADMIN_ACCOUNT_ID };
  if (!isAdminConfigured(config)) return null;
  let account;
  try { account = await getCurrentAccount(); }
  catch { throw new Error("The account service is temporarily unavailable."); }
  if (canAccessAdmin(account, config)) return account;
  if (!account) return null;
  try {
    const result = await getDatabasePool().query<{ account_id: string; approved_email: string; role: string }>(
      "select account_id, approved_email, role from public.arcus_admin_access where account_id = $1::uuid",
      [account.id],
    );
    const grant = result.rows[0];
    return grant?.role === "MODERATOR" && matchesDelegatedAdmin(account, grant ? { accountId: grant.account_id, email: grant.approved_email } : null) ? account : null;
  } catch { throw new Error("Admin authorization is temporarily unavailable."); }
});

export async function requireAdmin() {
  const account = await getAdminAccount();
  if (!account) redirect("/");
  return account;
}

/** API routes call this independently; layouts never serve as a mutation guard. */
export async function getAdminAccountFromRequest(request: Request) {
  return (await getAdminAuthorizationFromRequest(request))?.account ?? null;
}

export type AdminRole = "OWNER" | "MODERATOR";
export type AdminAuthorization = { account: NonNullable<Awaited<ReturnType<typeof getCurrentAccountFromRequest>>>; role: AdminRole };

export async function getAdminAuthorizationFromRequest(request: Request): Promise<AdminAuthorization | null> {
  const config = { email: process.env.ARCUS_ADMIN_EMAIL, accountId: process.env.ARCUS_ADMIN_ACCOUNT_ID };
  if (!isAdminConfigured(config)) return null;
  const account = await getCurrentAccountFromRequest(request);
  if (!account) return null;
  if (canAccessAdmin(account, config)) return { account, role: "OWNER" };
  const result = await getDatabasePool().query<{ account_id: string; approved_email: string; role: string }>(
    "select account_id, approved_email, role from public.arcus_admin_access where account_id = $1::uuid",
    [account.id],
  );
  const grant = result.rows[0];
  return grant?.role === "MODERATOR" && matchesDelegatedAdmin(account, grant ? { accountId: grant.account_id, email: grant.approved_email } : null)
    ? { account, role: "MODERATOR" }
    : null;
}

export async function getAdminRole(account: { id: string; email: string } | null): Promise<AdminRole | null> {
  if (!account) return null;
  if (isOwnerAccount(account)) return "OWNER";
  const result = await getDatabasePool().query<{ approved_email: string; role: string }>(
    "select approved_email, role from public.arcus_admin_access where account_id = $1::uuid",
    [account.id],
  );
  return result.rows[0]?.role === "MODERATOR"
    && result.rows[0].approved_email.toLowerCase() === account.email.trim().toLowerCase()
    ? "MODERATOR"
    : null;
}

export function isOwnerAccount(account: { id: string; email: string } | null) {
  return canAccessAdmin(account, { email: process.env.ARCUS_ADMIN_EMAIL, accountId: process.env.ARCUS_ADMIN_ACCOUNT_ID });
}

/** User and owner account IDs are both checked; email-only approval is never used. */
export async function getOwnerAccountFromRequest(request: Request) {
  const config = { email: process.env.ARCUS_ADMIN_EMAIL, accountId: process.env.ARCUS_ADMIN_ACCOUNT_ID };
  if (!isAdminConfigured(config)) return null;
  const account = await getCurrentAccountFromRequest(request);
  return canAccessAdmin(account, config) ? account : null;
}

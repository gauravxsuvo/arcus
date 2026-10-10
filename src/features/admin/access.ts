import type { AdminIdentity } from "./model.ts";

export type AdminAccessConfig = { email?: string; accountId?: string };
export type AdminRole = "OWNER" | "MODERATOR";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isAdminConfigured(config: AdminAccessConfig): boolean {
  return Boolean(config.email?.trim() && UUID.test(config.accountId?.trim() ?? ""));
}

// Signup does not verify emails. Pin the immutable account ID too, rather than
// allowing a new signup to gain owner access by claiming the configured email.
export function canAccessAdmin(account: AdminIdentity | null, config: AdminAccessConfig): boolean {
  if (!account || !isAdminConfigured(config)) return false;
  return account.id.toLowerCase() === config.accountId!.trim().toLowerCase()
    && account.email.trim().toLowerCase() === config.email!.trim().toLowerCase();
}

/** Owner access stays pinned to the server-configured immutable account ID. */
export const isOwnerAdmin = canAccessAdmin;

/** Delegated access matches both the account ID and current normalized email. */
export function matchesDelegatedAdmin(account: AdminIdentity | null, grant: { accountId: string; email: string } | null): boolean {
  if (!account || !grant) return false;
  return account.id.toLowerCase() === grant.accountId.toLowerCase()
    && account.email.trim().toLowerCase() === grant.email.trim().toLowerCase();
}

/** The root owner is immutable; moderators can only manage standard accounts. */
export function canManageUser(actorRole: AdminRole, targetRole: AdminRole | "USER", targetId: string, ownerId: string): boolean {
  if (targetId.toLowerCase() === ownerId.toLowerCase()) return false;
  return actorRole === "OWNER" || targetRole === "USER";
}

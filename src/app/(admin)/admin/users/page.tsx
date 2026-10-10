import type { Metadata } from "next";
import { UsersTable } from "@/components/admin/users-table";
import { getAdminUsers } from "@/features/admin/repository";
import { parseAdminQuery, type AdminSearchParams } from "@/features/admin/query";
import { getAdminRole, requireAdmin } from "@/lib/auth/admin";

export const metadata: Metadata = { title: "Users", description: "Review ARCUS accounts, workout totals, signup dates, and account status." };

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<AdminSearchParams> }) {
  const [account, params] = await Promise.all([requireAdmin(), searchParams]);
  const actorRole = await getAdminRole(account);
  const data = await getAdminUsers(parseAdminQuery(params));
  return <section>
    <p className="admin-eyebrow">Account directory</p>
    <h1 className="admin-page-title">Users</h1>
    <p className="admin-page-description">Registered accounts and their synced workout history.</p>
    <UsersTable data={data} ownerId={account.id} actorRole={actorRole ?? "MODERATOR"}/>
  </section>;
}

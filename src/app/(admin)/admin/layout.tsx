import type { Metadata } from "next";
import { getAdminRole, requireAdmin } from "@/lib/auth/admin";
import { AdminShell } from "@/components/admin/admin-shell";
import "./admin.css";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: { default: "Overview | ARCUS Admin", template: "%s | ARCUS Admin" },
  description: "Private owner console for reviewing and managing the ARCUS training platform.",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const account = await requireAdmin();
  const role = await getAdminRole(account);
  return <AdminShell adminName={account.name || account.username} adminRole={role ?? "MODERATOR"}>{children}</AdminShell>;
}

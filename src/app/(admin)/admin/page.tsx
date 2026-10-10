import { getAdminFeatureFlags, getAdminLivePulse, getAdminOverview } from "@/features/admin/repository";
import { OverviewDashboard } from "@/components/admin/overview-dashboard";
import { getAdminRole, requireAdmin } from "@/lib/auth/admin";

export default async function AdminOverviewPage() {
  const [account, data, pulse, featureFlags] = await Promise.all([
    requireAdmin(), getAdminOverview(), getAdminLivePulse(), getAdminFeatureFlags(),
  ]);
  const role = await getAdminRole(account);
  return <OverviewDashboard data={data} pulse={pulse} featureFlags={featureFlags} canManage={role === "OWNER"}/>;
}

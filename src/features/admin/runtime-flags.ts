import "server-only";
import { getDatabasePool } from "@/lib/db/pool";

export type PublicRuntimeSettings = { maintenanceMode: boolean; announcement: string };
let cached: { value: PublicRuntimeSettings; expiresAt: number } | null = null;
let pending: Promise<PublicRuntimeSettings> | null = null;

/** One short-cached query supplies the public shell with safe runtime switches. */
export async function getPublicRuntimeSettings(): Promise<PublicRuntimeSettings> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  if (pending) return pending;
  pending = getDatabasePool().query<{ maintenance_mode: boolean; announcement: string }>(`
    select coalesce((select enabled from public.arcus_feature_flags where flag_key='maintenance_mode'),false) as maintenance_mode,
      coalesce((select setting_value from public.arcus_platform_settings where setting_key='global_announcement'),'') as announcement
  `).then(result => ({ maintenanceMode: result.rows[0]?.maintenance_mode === true, announcement: result.rows[0]?.announcement ?? "" }))
    .catch(() => ({ maintenanceMode: false, announcement: "" }))
    .then(value => { cached = { value, expiresAt: Date.now() + 5_000 }; return value; })
    .finally(() => { pending = null; });
  return pending;
}

export async function isMaintenanceModeEnabled(): Promise<boolean> {
  return (await getPublicRuntimeSettings()).maintenanceMode;
}

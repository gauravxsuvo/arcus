import { getLocalSession, updateLocalUser } from "@/features/local-data/repository";
export async function flushProfile() {
  const user = await getLocalSession();
  if (!user || user.syncStatus === "synced" || !user.updatedAt || !navigator.onLine) return;
  const response = await fetch("/api/auth/profile", { method:"PUT",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:user.username,name:user.name,...user.profile,profileData:{preferences:user.profile.preferences,bodyMetrics:user.profile.bodyMetrics,bodyMetricsHistory:user.profile.bodyMetricsHistory,dateOfBirth:user.profile.dateOfBirth,targetGoals:user.profile.targetGoals,activeProgram:user.profile.activeProgram}}) });
  if (!response.ok) return;
  const current = await getLocalSession();
  if (current?.id === user.id && current.updatedAt === user.updatedAt) await updateLocalUser({...current,syncStatus:"synced"});
}

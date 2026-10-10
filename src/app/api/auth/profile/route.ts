import { NextResponse } from "next/server";
import { getCurrentAccountAvatarObjectKey, getCurrentAccountFromRequest, isUniqueViolation, updateCurrentAccount } from "@/lib/auth/server";
import { parseAvatar, ProfileInputError, readProfileBody } from "@/lib/auth/avatar";
import { deleteProfileAvatar, putProfileAvatar } from "@/lib/storage/portways-s3";
import { profileDetailsSchema } from "@/features/profile/schema";

export const runtime = "nodejs";

export async function PUT(request: Request) {
  try {
    const account = await getCurrentAccountFromRequest(request);
    if (!account) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    const body = await readProfileBody(request);
    const avatar = parseAvatar(body.avatarUrl);
    const details = body.profileData === undefined ? undefined : profileDetailsSchema.safeParse(body.profileData);
    if(details && !details.success) return NextResponse.json({error:details.error.issues[0]?.message ?? "Invalid profile settings."},{status:400});
    const username = typeof body.username === "string" ? body.username.trim() : undefined;
    if (username !== undefined && !/^[A-Za-z0-9_]{3,32}$/.test(username)) return NextResponse.json({ error: "Use 3–32 letters, numbers, or underscores for your username." }, { status: 400 });
    const bio = typeof body.bio === "string" ? body.bio.trim().slice(0, 160) : null;
    const goals = Array.isArray(body.goals) ? body.goals.filter((item): item is string => typeof item === "string").slice(0, 20) : [];
    const height = body.height_cm === null || body.height_cm === undefined || body.height_cm === "" ? null : Number(body.height_cm);
    const oldAvatarKey = avatar === undefined ? null : await getCurrentAccountAvatarObjectKey(account.id);
    const avatarObjectKey = avatar === undefined ? undefined : avatar ? await putProfileAvatar(account.id, avatar) : null;
    let user;
    try {
      user = await updateCurrentAccount(account, { username, name: typeof body.name === "string" ? body.name : undefined, bio, experience: typeof body.experience === "string" ? body.experience : null, goals, height_cm: Number.isFinite(height) ? height : null, avatarObjectKey, profileData: details?.success ? details.data : undefined });
    } catch (error) {
      if (avatarObjectKey) await deleteProfileAvatar(avatarObjectKey).catch(() => undefined);
      throw error;
    }
    if (oldAvatarKey && oldAvatarKey !== avatarObjectKey && avatar !== undefined) {
      await deleteProfileAvatar(oldAvatarKey).catch((error: unknown) => {
        const value = typeof error === "object" && error !== null ? error as { name?: unknown; $metadata?: { httpStatusCode?: number } } : {};
        console.warn("Old ARCUS profile photo cleanup failed", { name: typeof value.name === "string" ? value.name : "StorageError", status: value.$metadata?.httpStatusCode });
      });
    }
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof ProfileInputError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (isUniqueViolation(error)) return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    const value = typeof error === "object" && error !== null ? error as { name?: unknown; code?: unknown; $metadata?: { httpStatusCode?: number } } : {};
    console.error("Arcus profile update failed", { name: typeof value.name === "string" ? value.name : "Error", code: typeof value.code === "string" ? value.code : undefined, status: value.$metadata?.httpStatusCode });
    return NextResponse.json({ error: "Could not save your profile." }, { status: 503 });
  }
}

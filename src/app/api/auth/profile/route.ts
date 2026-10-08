import { NextResponse } from "next/server";
import { getCurrentAccountFromRequest, isUniqueViolation, updateCurrentAccount } from "@/lib/auth/server";
import { parseAvatar, ProfileInputError, readProfileBody } from "@/lib/auth/avatar";
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
    const user = await updateCurrentAccount(account, { username, name: typeof body.name === "string" ? body.name : undefined, bio, experience: typeof body.experience === "string" ? body.experience : null, goals, height_cm: Number.isFinite(height) ? height : null, avatar, profileData: details?.success ? details.data : undefined });
    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof ProfileInputError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (isUniqueViolation(error)) return NextResponse.json({ error: "That username is already taken." }, { status: 409 });
    console.error("Arcus profile update failed", error);
    return NextResponse.json({ error: "Could not save your profile." }, { status: 503 });
  }
}

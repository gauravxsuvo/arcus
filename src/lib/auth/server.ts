import "server-only";

import { createHash, randomBytes, randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { getDatabasePool } from "@/lib/db/pool";
import { hashPassword, verifyPassword } from "./password";
import type { ProfileDetails, UserProfile } from "@/features/profile/model";
import { avatarDataUrl } from "./avatar";

export const SESSION_COOKIE = "arcus_session";
const SESSION_DAYS = 30;

export type AccountView = {
  id: string;
  username: string;
  email: string;
  name: string;
  isPro: boolean;
  subscriptionStatus: "inactive" | "incomplete" | "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "paused";
  profile: UserProfile;
};

type AccountRow = {
  id: string;
  username: string;
  email: string;
  display_name: string;
  experience: string | null;
  goals: unknown;
  height_cm: number | string | null;
  bio: string | null;
  avatar_image: Buffer | null;
  avatar_mime_type: string | null;
  avatar_object_key: string | null;
  profile_data: ProfileDetails;
  is_pro: boolean;
  subscription_status: AccountView["subscriptionStatus"];
};

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function toAccountView(row: AccountRow): AccountView {
  const goals = Array.isArray(row.goals) ? row.goals.filter((item): item is string => typeof item === "string") : [];
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    name: row.display_name,
    isPro: row.is_pro,
    subscriptionStatus: row.subscription_status,
    profile: { ...row.profile_data, experience: row.experience, goals, height_cm: row.height_cm === null ? null : Number(row.height_cm), bio: row.bio ?? null, avatarUrl: row.avatar_object_key ? `/api/auth/avatar?v=${createHash("sha256").update(row.avatar_object_key).digest("hex").slice(0, 16)}` : avatarDataUrl(row.avatar_image, row.avatar_mime_type) },
  };
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function createSession(accountId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await getDatabasePool().query(
    "insert into public.arcus_sessions (id, account_id, token_hash, expires_at) values ($1, $2, $3, $4)",
    [randomUUID(), accountId, tokenHash(token), expiresAt],
  );
  return { token, expiresAt };
}

export async function createPasskeySession(accountId: string) {
  return createSession(accountId);
}

export function setSessionCookie(response: Response, token: string, expiresAt: Date) {
  const value = `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor((expiresAt.getTime() - Date.now()) / 1000)}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
  response.headers.append("Set-Cookie", value);
}

export function clearSessionCookie(response: Response) {
  response.headers.append("Set-Cookie", `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
}

async function accountFromToken(token: string | undefined): Promise<AccountView | null> {
  if (!token) return null;
  const result = await getDatabasePool().query<AccountRow>(
    `select a.id, a.username, a.email, a.display_name, a.experience, a.goals, a.height_cm, a.bio, a.avatar_image, a.avatar_mime_type, a.avatar_object_key, a.profile_data, a.is_pro, a.subscription_status
       from public.arcus_sessions s
       join public.arcus_accounts a on a.id = s.account_id
       where s.token_hash = $1 and s.expires_at > now() and a.is_banned = false
         and (a.is_suspended = false or a.suspended_until <= now())`
    , [tokenHash(token)],
  );
  return result.rows[0] ? toAccountView(result.rows[0]) : null;
}

export async function getCurrentAccount() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  return accountFromToken(token);
}

export async function getCurrentAccountFromRequest(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const token = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  return accountFromToken(token ? decodeURIComponent(token) : undefined);
}

export async function getAccountById(accountId: string) {
  const result = await getDatabasePool().query<AccountRow>(
    `select id, username, email, display_name, experience, goals, height_cm, bio, avatar_image, avatar_mime_type, avatar_object_key, profile_data, is_pro, subscription_status
       from public.arcus_accounts where id = $1 and is_banned = false
         and (is_suspended = false or suspended_until <= now())`,
    [accountId],
  );
  return result.rows[0] ? toAccountView(result.rows[0]) : null;
}

export async function registerAccount(input: { username: string; email: string; password: string; name: string }) {
  const id = randomUUID();
  const username = input.username.trim();
  const email = input.email.trim();
  const usernameNormalized = normalizeUsername(username);
  const emailNormalized = normalizeEmail(email);
  const passwordHash = await hashPassword(input.password);
  const result = await getDatabasePool().query<AccountRow>(
    `insert into public.arcus_accounts (id, username, username_normalized, email, email_normalized, password_hash, display_name)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id, username, email, display_name, experience, goals, height_cm, bio, avatar_image, avatar_mime_type, avatar_object_key, profile_data, is_pro, subscription_status`,
    [id, username, usernameNormalized, email, emailNormalized, passwordHash, input.name.trim()],
  );
  const session = await createSession(id);
  return { user: toAccountView(result.rows[0]), session };
}

export async function loginAccount(usernameInput: string, password: string) {
  const result = await getDatabasePool().query<AccountRow & { password_hash: string }>(
    `select id, username, email, display_name, experience, goals, height_cm, bio, avatar_image, avatar_mime_type, avatar_object_key, profile_data, is_pro, subscription_status, password_hash
       from public.arcus_accounts where username_normalized = $1 and is_banned = false
         and (is_suspended = false or suspended_until <= now())`,
    [normalizeUsername(usernameInput)],
  );
  const row = result.rows[0];
  if (!row || !(await verifyPassword(password, row.password_hash))) throw new Error("Incorrect username or password.");
  const session = await createSession(row.id);
  return { user: toAccountView(row), session };
}

export async function logoutCurrentAccount(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const token = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  if (token) await getDatabasePool().query("delete from public.arcus_sessions where token_hash = $1", [tokenHash(decodeURIComponent(token))]);
}

export async function getCurrentAccountAvatarObjectKey(accountId: string) {
  const result = await getDatabasePool().query<{ avatar_object_key: string | null }>(
    "select avatar_object_key from public.arcus_accounts where id = $1 and is_banned = false and (is_suspended = false or suspended_until <= now())",
    [accountId],
  );
  return result.rows[0]?.avatar_object_key ?? null;
}

export async function updateCurrentAccount(account: AccountView, input: { username?: string; name?: string; bio?: string | null; experience?: string | null; goals?: string[]; height_cm?: number | null; avatarObjectKey?: string | null; profileData?: ProfileDetails }) {
  const result = await getDatabasePool().query<AccountRow>(
    `update public.arcus_accounts
        set username = coalesce($2, username), username_normalized = coalesce($3, username_normalized), display_name = coalesce($4, display_name), bio = $5, experience = $6, goals = $7::jsonb, height_cm = $8,
            avatar_object_key = case when $9 then $10::text else avatar_object_key end,
            avatar_image = case when $9 then null else avatar_image end,
            avatar_mime_type = case when $9 then null else avatar_mime_type end,
            profile_data = case when $11 then $12::jsonb else profile_data end, updated_at = now()
      where id = $1
      returning id, username, email, display_name, experience, goals, height_cm, bio, avatar_image, avatar_mime_type, avatar_object_key, profile_data, is_pro, subscription_status`,
    [account.id, input.username?.trim() || null, input.username ? normalizeUsername(input.username) : null, input.name?.trim() || null, input.bio ?? null, input.experience ?? null, JSON.stringify(input.goals ?? []), input.height_cm ?? null, input.avatarObjectKey !== undefined, input.avatarObjectKey ?? null, input.profileData !== undefined, JSON.stringify(input.profileData ?? {})],
  );
  return toAccountView(result.rows[0]);
}

export function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "23505";
}

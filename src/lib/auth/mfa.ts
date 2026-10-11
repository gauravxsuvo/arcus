import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { generate, generateSecret, generateURI } from "otplib";
import { getDatabasePool } from "@/lib/db/pool";
import { hashPassword, verifyPassword } from "./password";

export const MFA_CHALLENGE_COOKIE = "arcus_mfa_challenge";
export const MFA_CHALLENGE_TTL_MS = 5 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function encryptionKey() {
  const encoded = process.env.ARCUS_TOTP_ENCRYPTION_KEY?.trim();
  if (!encoded) throw new Error("ARCUS_TOTP_ENCRYPTION_KEY is required to protect authenticator secrets.");
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32 || key.toString("base64").replace(/=+$/, "") !== encoded.replace(/=+$/, "")) {
    throw new Error("ARCUS_TOTP_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  }
  return key;
}

export function encryptTotpSecret(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptTotpSecret(value: string) {
  const [version, encodedIv, encodedTag, encodedBody] = value.split(".");
  if (version !== "v1" || !encodedIv || !encodedTag || !encodedBody) throw new Error("Stored authenticator secret has an unsupported format.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(encodedIv, "base64url"));
  decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encodedBody, "base64url")), decipher.final()]).toString("utf8");
}

export function newTotpSecret() {
  return generateSecret({ length: 20 });
}

export function totpUri(email: string, secret: string) {
  return generateURI({ issuer: "ARCUS", label: email, secret, algorithm: "sha1", digits: 6, period: 30 });
}

export async function verifyTotpCode(secret: string, token: string) {
  if (!/^\d{6}$/.test(token)) return false;
  const now = Date.now() / 1000;
  const candidates = await Promise.all([-30, 0, 30].map((offset) => generate({
    secret,
    algorithm: "sha1",
    digits: 6,
    period: 30,
    epoch: now + offset,
  })));
  const supplied = Buffer.from(token, "ascii");
  let matched = false;
  for (const candidate of candidates) matched = timingSafeEqual(supplied, Buffer.from(candidate, "ascii")) || matched;
  return matched;
}

export function opaqueToken() {
  return randomBytes(32).toString("base64url");
}

export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createMfaChallenge(accountId: string) {
  const token = opaqueToken();
  const expiresAt = new Date(Date.now() + MFA_CHALLENGE_TTL_MS);
  await getDatabasePool().query(
    `with cleanup as (delete from public.arcus_mfa_challenges where expires_at < now() - interval '1 day' or consumed_at < now() - interval '1 day')
     insert into public.arcus_mfa_challenges(id,account_id,token_hash,expires_at) values($1,$2,$3,$4)`,
    [randomUUID(), accountId, tokenHash(token), expiresAt],
  );
  return { token, expiresAt };
}

export function mfaChallengeCookieValue(token: string, expiresAt: Date) {
  return `${MFA_CHALLENGE_COOKIE}=${encodeURIComponent(token)}; Path=/api/auth/mfa; HttpOnly; SameSite=Strict; Max-Age=${Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export function clearMfaChallengeCookie() {
  return `${MFA_CHALLENGE_COOKIE}=; Path=/api/auth/mfa; HttpOnly; SameSite=Strict; Max-Age=0${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
}

export function mfaChallengeFromRequest(request: Request) {
  const value = request.headers.get("cookie") ?? "";
  const cookie = value.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${MFA_CHALLENGE_COOKIE}=`));
  return cookie ? decodeURIComponent(cookie.slice(MFA_CHALLENGE_COOKIE.length + 1)) : null;
}

function rateLimitHash(scope: string, accountId: string, ip: string) {
  return createHash("sha256").update(`${scope}\0${accountId}\0${ip}`).digest("hex");
}

export async function isMfaRateLimited(scope: string, accountId: string, ip: string) {
  const key = rateLimitHash(scope, accountId, ip);
  const result = await getDatabasePool().query<{ attempts: number }>(
    `with cleanup as (delete from public.arcus_auth_rate_limits where updated_at < now() - interval '1 day')
     insert into public.arcus_auth_rate_limits(key_hash,attempts,window_started_at,updated_at)
     values($1,1,now(),now())
     on conflict(key_hash) do update set
       attempts=case when arcus_auth_rate_limits.window_started_at <= now() - interval '15 minutes' then 1 else arcus_auth_rate_limits.attempts + 1 end,
       window_started_at=case when arcus_auth_rate_limits.window_started_at <= now() - interval '15 minutes' then now() else arcus_auth_rate_limits.window_started_at end,
       updated_at=now()
     returning attempts`, [key],
  );
  return Number(result.rows[0]?.attempts ?? MAX_ATTEMPTS + 1) > MAX_ATTEMPTS;
}

export async function clearMfaFailures(scope: string, accountId: string, ip: string) {
  await getDatabasePool().query("delete from public.arcus_auth_rate_limits where key_hash=$1", [rateLimitHash(scope, accountId, ip)]);
}

export function createBackupCodes() {
  return Array.from({ length: 8 }, () => randomBytes(16).toString("hex"));
}

export async function hashBackupCodes(codes: string[]) {
  return Promise.all(codes.map((code) => hashPassword(code)));
}

export async function matchBackupCode(code: string, hashes: string[]) {
  if (!/^[a-f0-9]{32}$/i.test(code)) return -1;
  const matches = await Promise.all(hashes.map((hash) => verifyPassword(code.toLowerCase(), hash)));
  return matches.findIndex(Boolean);
}

export async function getLiveMfaChallengeAccount(token: string) {
  const result = await getDatabasePool().query<{ account_id: string }>(
    "select account_id from public.arcus_mfa_challenges where token_hash=$1 and expires_at>now() and consumed_at is null",
    [tokenHash(token)],
  );
  return result.rows[0]?.account_id ?? null;
}

export async function completeMfaChallenge(token: string, code: string) {
  const client = await getDatabasePool().connect();
  try {
    await client.query("begin");
    const challenge = await client.query<{ id: string; account_id: string }>(
      "select id,account_id from public.arcus_mfa_challenges where token_hash=$1 and expires_at>now() and consumed_at is null for update",
      [tokenHash(token)],
    );
    const item = challenge.rows[0];
    if (!item) throw new Error("The sign-in verification expired. Please sign in again.");
    const accountResult = await client.query<{
      totp_enabled: boolean; totp_secret_enc: string | null; totp_backup_codes: string[];
      is_banned: boolean; is_suspended: boolean; suspended_until: Date | null;
    }>(
      `select totp_enabled,totp_secret_enc,totp_backup_codes,is_banned,is_suspended,suspended_until
         from public.arcus_accounts where id=$1 for update`, [item.account_id],
    );
    const account = accountResult.rows[0];
    if (!account || !account.totp_enabled || !account.totp_secret_enc || account.is_banned || (account.is_suspended && (!account.suspended_until || new Date(account.suspended_until).getTime() > Date.now()))) {
      throw new Error("The sign-in verification expired. Please sign in again.");
    }
    const validTotp = await verifyTotpCode(decryptTotpSecret(account.totp_secret_enc), code);
    let backupIndex = -1;
    if (!validTotp) backupIndex = await matchBackupCode(code, account.totp_backup_codes ?? []);
    if (!validTotp && backupIndex < 0) throw new Error("That verification code is incorrect.");
    if (backupIndex >= 0) {
      const remaining = account.totp_backup_codes.filter((_, index) => index !== backupIndex);
      await client.query("update public.arcus_accounts set totp_backup_codes=$2 where id=$1", [item.account_id, remaining]);
    }
    await client.query("update public.arcus_mfa_challenges set consumed_at=now() where id=$1", [item.id]);
    await client.query("commit");
    return item.account_id;
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export async function makePasswordReset(accountId: string) {
  const token = opaqueToken();
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
  const hash = tokenHash(token);
  await getDatabasePool().query(
    `with stale as (delete from public.arcus_password_reset_tokens where expires_at < now() - interval '1 day' and account_id <> $2),
          prior as (delete from public.arcus_password_reset_tokens where account_id=$2 and consumed_at is null)
     insert into public.arcus_password_reset_tokens(id,account_id,token_hash,expires_at) values($1,$2,$3,$4)`,
    [randomUUID(), accountId, hash, expiresAt],
  );
  return { token, tokenHash: hash, expiresAt };
}

export async function revokePasswordReset(tokenDigest: string) {
  await getDatabasePool().query("delete from public.arcus_password_reset_tokens where token_hash=$1 and consumed_at is null", [tokenDigest]);
}

export function getRequestIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",", 1)[0]?.trim();
  const address = request.headers.get("x-real-ip")?.trim() || forwarded || "unknown";
  return createHash("sha256").update(address).digest("hex");
}


import "server-only";

import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { randomUUID } from "node:crypto";
import { getDatabasePool } from "@/lib/db/pool";
import { siteOrigin } from "@/lib/site-metadata";
import { createPasskeySession, getAccountById, type AccountView } from "./server";

const CHALLENGE_LIFETIME_MS = 5 * 60 * 1000;

function relyingParty(request: Request) {
  const requestUrl = new URL(request.url);
  const localHost = ["localhost", "127.0.0.1", "::1"].includes(requestUrl.hostname);
  const origin = process.env.WEBAUTHN_ORIGIN?.trim()
    ? siteOrigin({ SITE_URL: process.env.WEBAUTHN_ORIGIN }).origin
    : process.env.SITE_URL?.trim()
      ? siteOrigin({ SITE_URL: process.env.SITE_URL }).origin
      : localHost ? requestUrl.origin : siteOrigin({ SITE_URL: process.env.SITE_URL, VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL, VERCEL_URL: process.env.VERCEL_URL }).origin;
  const url = new URL(origin);
  return { origin, rpID: process.env.WEBAUTHN_RP_ID?.trim() || url.hostname };
}

async function storeChallenge(purpose: "registration" | "authentication", challenge: string, accountId: string | null) {
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + CHALLENGE_LIFETIME_MS);
  await getDatabasePool().query(
    "insert into public.arcus_passkey_challenges (id, account_id, purpose, challenge, expires_at) values ($1, $2, $3, $4, $5)",
    [id, accountId, purpose, challenge, expiresAt],
  );
  return id;
}

async function consumeChallenge(id: string, purpose: "registration" | "authentication") {
  const result = await getDatabasePool().query<{ challenge: string; account_id: string | null }>(
    "delete from public.arcus_passkey_challenges where id = $1 and purpose = $2 and expires_at > now() returning challenge, account_id",
    [id, purpose],
  );
  if (!result.rows[0]) throw new Error("This passkey request expired. Please start again.");
  return result.rows[0];
}

export async function registrationOptions(account: AccountView, request: Request) {
  const { rpID } = relyingParty(request);
  const existing = await getDatabasePool().query<{ credential_id: string; transports: unknown }>(
    "select credential_id, transports from public.arcus_passkeys where account_id = $1",
    [account.id],
  );
  const options = await generateRegistrationOptions({
    rpName: "ARCUS",
    rpID,
    userID: new TextEncoder().encode(account.id),
    userName: account.username,
    userDisplayName: account.name || account.username,
    attestationType: "none",
    excludeCredentials: existing.rows.map((item) => ({ id: item.credential_id, transports: Array.isArray(item.transports) ? item.transports as string[] : undefined })),
    authenticatorSelection: { authenticatorAttachment: "platform", residentKey: "required", userVerification: "required" },
  });
  const challengeId = await storeChallenge("registration", options.challenge, account.id);
  return { options, challengeId };
}

export async function verifyRegistration(account: AccountView, request: Request, challengeId: string, response: RegistrationResponseJSON) {
  const stored = await consumeChallenge(challengeId, "registration");
  if (stored.account_id !== account.id) throw new Error("This passkey request belongs to another account.");
  const { origin, rpID } = relyingParty(request);
  const verification = await verifyRegistrationResponse({ response, expectedChallenge: stored.challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true });
  if (!verification.verified || !verification.registrationInfo) throw new Error("Your device could not verify the passkey.");
  const credential = verification.registrationInfo.credential;
  await getDatabasePool().query(
    `insert into public.arcus_passkeys (id, account_id, credential_id, public_key, counter, transports, device_type, backed_up)
     values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)`,
    [randomUUID(), account.id, credential.id, Buffer.from(credential.publicKey), credential.counter, JSON.stringify(credential.transports ?? []), verification.registrationInfo.credentialDeviceType, verification.registrationInfo.credentialBackedUp],
  );
}

export async function authenticationOptions(request: Request, username?: string) {
  const { rpID } = relyingParty(request);
  let accountId: string | null = null;
  let allowCredentials: { id: string; transports?: string[] }[] | undefined;
  if (username?.trim()) {
    const result = await getDatabasePool().query<{ id: string; credential_id: string; transports: unknown }>(
      `select a.id, p.credential_id, p.transports from public.arcus_accounts a
       join public.arcus_passkeys p on p.account_id = a.id
       where a.username_normalized = $1 and a.is_banned = false
         and (a.is_suspended = false or a.suspended_until <= now())`,
      [username.trim().toLowerCase()],
    );
    if (!result.rows.length) throw new Error("No passkey is registered for that username.");
    accountId = result.rows[0].id;
    allowCredentials = result.rows.map((item) => ({ id: item.credential_id, transports: Array.isArray(item.transports) ? item.transports as string[] : undefined }));
  }
  const options = await generateAuthenticationOptions({ rpID, allowCredentials, userVerification: "required" });
  const challengeId = await storeChallenge("authentication", options.challenge, accountId);
  return { options, challengeId };
}

type PasskeyRow = { id: string; account_id: string; credential_id: string; public_key: Buffer; counter: number | string; transports: unknown; is_banned: boolean; is_suspended: boolean; suspended_until: Date | null };

export async function verifyAuthentication(request: Request, challengeId: string, response: AuthenticationResponseJSON) {
  const stored = await consumeChallenge(challengeId, "authentication");
  const result = await getDatabasePool().query<PasskeyRow>(
    `select p.id, p.account_id, p.credential_id, p.public_key, p.counter, p.transports,
            a.is_banned, a.is_suspended, a.suspended_until
       from public.arcus_passkeys p join public.arcus_accounts a on a.id = p.account_id
       where p.credential_id = $1`,
    [response.id],
  );
  const row = result.rows[0];
  if (!row || row.is_banned || (row.is_suspended && (!row.suspended_until || new Date(row.suspended_until).getTime() > Date.now())) || (stored.account_id && stored.account_id !== row.account_id)) throw new Error("This passkey could not sign in to that account.");
  const credential = {
    id: row.credential_id,
    publicKey: new Uint8Array(row.public_key),
    counter: Number(row.counter),
    transports: Array.isArray(row.transports) ? row.transports as string[] : undefined,
  };
  const { origin, rpID } = relyingParty(request);
  const verification = await verifyAuthenticationResponse({ response, expectedChallenge: stored.challenge, expectedOrigin: origin, expectedRPID: rpID, credential, requireUserVerification: true });
  if (!verification.verified) throw new Error("This passkey could not be verified.");
  await getDatabasePool().query("update public.arcus_passkeys set counter = $2, last_used_at = now() where id = $1", [row.id, verification.authenticationInfo.newCounter]);
  const user = await getAccountById(row.account_id);
  if (!user) throw new Error("This account is unavailable.");
  const session = await createPasskeySession(user.id);
  return { user, session };
}

export async function listPasskeys(accountId: string) {
  const result = await getDatabasePool().query<{ id: string; created_at: Date | string; last_used_at: Date | string | null; device_type: string; backed_up: boolean }>(
    "select id, created_at, last_used_at, device_type, backed_up from public.arcus_passkeys where account_id = $1 order by created_at desc",
    [accountId],
  );
  return result.rows.map((row) => ({ id: row.id, createdAt: row.created_at, lastUsedAt: row.last_used_at, deviceType: row.device_type, backedUp: row.backed_up }));
}

export async function deletePasskey(accountId: string, id: string) {
  const result = await getDatabasePool().query("delete from public.arcus_passkeys where id = $1 and account_id = $2", [id, accountId]);
  return result.rowCount === 1;
}

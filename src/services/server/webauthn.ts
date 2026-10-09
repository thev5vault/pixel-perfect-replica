import { createHash, randomBytes, randomUUID } from "node:crypto";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import type { PoolClient } from "pg";
import { inTransaction, pool } from "./db";

const SESSION_COOKIE = "v5vault_passkey_session";
const CHALLENGE_LIFETIME_MS = 5 * 60 * 1000;
const SESSION_LIFETIME_SECONDS = 14 * 24 * 60 * 60;

export class WebAuthnError extends Error {
  constructor(message: string, readonly status = 400, readonly code?: string) {
    super(message);
    this.name = "WebAuthnError";
  }
}

type WebAuthnUser = {
  id: string;
  email: string;
  full_name?: string;
  email_verified?: boolean;
};

type RequestContext = { origin: string; rpId: string; secure: boolean };

export function webAuthnRequestContext(request: Request): RequestContext {
  const originHeader = request.headers.get("origin");
  if (!originHeader) throw new WebAuthnError("Passkey request origin is missing.", 403);
  let origin: URL;
  try {
    origin = new URL(originHeader);
  } catch {
    throw new WebAuthnError("Passkey request origin is invalid.", 403);
  }
  const localHttp = origin.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  if (origin.protocol !== "https:" && !localHttp) {
    throw new WebAuthnError("Passkeys require a secure connection.", 403);
  }
  const requestUrl = new URL(request.url);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const expectedHost = (forwardedHost || request.headers.get("host") || requestUrl.host).toLowerCase();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const expectedOrigin = `${forwardedProto || requestUrl.protocol.replace(":", "")}://${expectedHost}`;
  if (origin.host.toLowerCase() !== expectedHost && origin.host.toLowerCase() !== requestUrl.host.toLowerCase()) {
    throw new WebAuthnError("Passkey request origin does not match this site.", 403);
  }
  if (origin.origin !== expectedOrigin && origin.origin !== requestUrl.origin) {
    throw new WebAuthnError("Passkey request origin does not match this site.", 403);
  }
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    throw new WebAuthnError("Cross-site passkey requests are not allowed.", 403);
  }
  return { origin: origin.origin, rpId: origin.hostname, secure: origin.protocol === "https:" };
}

function sessionToken(request: Request): string | null {
  const cookies = request.headers.get("cookie")?.split(";") ?? [];
  const cookie = cookies.map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  const token = cookie?.slice(SESSION_COOKIE.length + 1);
  return token && /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function getPasskeySessionUserId(request: Request): Promise<string | undefined> {
  const token = sessionToken(request);
  if (!token) return undefined;
  const result = await pool.query(
    `SELECT s.user_id FROM webauthn_sessions s
     JOIN user_accounts u ON u.id=s.user_id
     WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at > now()`,
    [hashToken(token)],
  );
  return result.rows[0]?.user_id as string | undefined;
}

export function passkeySessionCookie(token: string, secure: boolean, maxAge = SESSION_LIFETIME_SECONDS): string {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? "; Secure" : ""}`;
}

async function saveChallenge(input: {
  id: string;
  flow: "registration" | "authentication";
  userId?: string;
  challenge: string;
  context: RequestContext;
}) {
  await pool.query("DELETE FROM webauthn_challenges WHERE expires_at <= now()");
  return pool.query(
    `INSERT INTO webauthn_challenges(id,flow,user_id,challenge,origin,rp_id,expires_at)
     VALUES($1,$2,$3,$4,$5,$6,now()+($7::double precision * interval '1 millisecond'))`,
    [input.id, input.flow, input.userId ?? null, input.challenge, input.context.origin, input.context.rpId, CHALLENGE_LIFETIME_MS],
  );
}

async function consumeChallenge(
  request: Request,
  id: string,
  flow: "registration" | "authentication",
  userId?: string,
) {
  const context = webAuthnRequestContext(request);
  const result = await pool.query(
    `DELETE FROM webauthn_challenges
     WHERE id=$1 AND flow=$2 AND (($3::text IS NULL AND user_id IS NULL) OR user_id=$3)
       AND expires_at > now()
     RETURNING challenge,origin,rp_id`,
    [id, flow, userId ?? null],
  );
  const challenge = result.rows[0];
  if (!challenge || challenge.origin !== context.origin || challenge.rp_id !== context.rpId) {
    throw new WebAuthnError("This passkey request expired. Start again.", 400);
  }
  return { challenge: challenge.challenge as string, origin: challenge.origin as string, rpId: challenge.rp_id as string };
}

async function getStableUserHandle(userId: string): Promise<string> {
  const existing = await pool.query("SELECT webauthn_user_handle FROM user_accounts WHERE id=$1", [userId]);
  if (!existing.rows[0]) throw new WebAuthnError("Account could not be loaded.", 404);
  if (existing.rows[0].webauthn_user_handle) return existing.rows[0].webauthn_user_handle as string;
  const candidate = randomBytes(32).toString("base64url");
  const updated = await pool.query(
    "UPDATE user_accounts SET webauthn_user_handle=$2 WHERE id=$1 AND webauthn_user_handle IS NULL RETURNING webauthn_user_handle",
    [userId, candidate],
  );
  if (updated.rows[0]?.webauthn_user_handle) return updated.rows[0].webauthn_user_handle as string;
  const raced = await pool.query("SELECT webauthn_user_handle FROM user_accounts WHERE id=$1", [userId]);
  if (!raced.rows[0]?.webauthn_user_handle) throw new WebAuthnError("Could not prepare this account for passkey registration.", 500);
  return raced.rows[0].webauthn_user_handle as string;
}

export async function createRegistrationOptions(request: Request, user: WebAuthnUser) {
  if (!user.email_verified) throw new WebAuthnError("Verify your email before adding a passkey.", 403);
  const context = webAuthnRequestContext(request);
  const [userHandle, credentialResult] = await Promise.all([
    getStableUserHandle(user.id),
    pool.query("SELECT credential_id,transports FROM webauthn_credentials WHERE user_id=$1", [user.id]),
  ]);
  const options = await generateRegistrationOptions({
    rpName: "V5Vault",
    rpID: context.rpId,
    userName: user.email,
    userDisplayName: user.full_name || user.email,
    userID: Buffer.from(userHandle, "base64url"),
    attestationType: "none",
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
    excludeCredentials: credentialResult.rows.map((credential) => ({
      id: credential.credential_id as string,
      transports: (credential.transports ?? []) as string[],
    })),
  });
  const challengeId = randomUUID();
  await saveChallenge({ id: challengeId, flow: "registration", userId: user.id, challenge: options.challenge, context });
  return { challengeId, options };
}

export async function verifyRegistration(
  request: Request,
  user: WebAuthnUser,
  challengeId: string,
  response: unknown,
) {
  if (!user.email_verified) throw new WebAuthnError("Verify your email before adding a passkey.", 403);
  const expected = await consumeChallenge(request, challengeId, "registration", user.id);
  const verification = await verifyRegistrationResponse({
    response: response as RegistrationResponseJSON,
    expectedChallenge: expected.challenge,
    expectedOrigin: expected.origin,
    expectedRPID: expected.rpId,
    requireUserVerification: true,
  });
  const info = verification.registrationInfo;
  if (!verification.verified || !info) throw new WebAuthnError("Passkey registration could not be verified.", 400);
  const userHandle = await getStableUserHandle(user.id);
  try {
    await pool.query(
      `INSERT INTO webauthn_credentials
       (credential_id,user_id,user_handle,public_key,counter,transports,device_type,backed_up)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        info.credential.id,
        user.id,
        userHandle,
        Buffer.from(info.credential.publicKey),
        info.credential.counter,
        info.credential.transports ?? [],
        info.credentialDeviceType,
        info.credentialBackedUp,
      ],
    );
  } catch (error) {
    if ((error as { code?: string })?.code === "23505") {
      throw new WebAuthnError("This passkey is already registered.", 409);
    }
    throw error;
  }
  return { verified: true, count: await getPasskeyCount(user.id) };
}

export async function createAuthenticationOptions(request: Request) {
  const context = webAuthnRequestContext(request);
  const exists = await pool.query("SELECT EXISTS(SELECT 1 FROM webauthn_credentials) AS has_credentials");
  if (!exists.rows[0]?.has_credentials) {
    throw new WebAuthnError("No Face ID linked yet. Please sign in and register Face ID in Account Settings.", 404, "NO_PASSKEYS_REGISTERED");
  }
  const options = await generateAuthenticationOptions({
    rpID: context.rpId,
    userVerification: "required",
    allowCredentials: [],
  });
  const challengeId = randomUUID();
  await saveChallenge({ id: challengeId, flow: "authentication", challenge: options.challenge, context });
  return { challengeId, options };
}

async function createSession(userId: string, secure: boolean, db: PoolClient): Promise<string> {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_SECONDS * 1000);
  await db.query("DELETE FROM webauthn_sessions WHERE expires_at <= now() OR revoked_at < now() - interval '30 days'");
  await db.query(
    "INSERT INTO webauthn_sessions(token_hash,user_id,expires_at) VALUES($1,$2,$3)",
    [tokenHash, userId, expiresAt],
  );
  return passkeySessionCookie(token, secure);
}

export async function verifyAuthentication(request: Request, challengeId: string, response: unknown) {
  const expected = await consumeChallenge(request, challengeId, "authentication");
  const assertion = response as AuthenticationResponseJSON;
  if (!assertion?.id || !assertion.response?.userHandle) {
    throw new WebAuthnError("No matching passkey was found. Try again or sign in with email.", 401);
  }
  const found = await pool.query(
    "SELECT * FROM webauthn_credentials WHERE credential_id=$1",
    [assertion.id],
  );
  const credential = found.rows[0];
  if (!credential || credential.user_handle !== assertion.response.userHandle) {
    throw new WebAuthnError("No matching passkey was found. Try again or sign in with email.", 401);
  }
  const verification = await verifyAuthenticationResponse({
    response: assertion,
    expectedChallenge: expected.challenge,
    expectedOrigin: expected.origin,
    expectedRPID: expected.rpId,
    credential: {
      id: credential.credential_id as string,
      publicKey: new Uint8Array(credential.public_key as Buffer),
      counter: Number(credential.counter),
      transports: (credential.transports ?? []) as string[],
    },
    requireUserVerification: true,
  });
  if (!verification.verified) throw new WebAuthnError("Passkey sign-in could not be verified.", 401);
  const context = webAuthnRequestContext(request);
  const cookie = await inTransaction(async (db) => {
    await db.query(
      "UPDATE webauthn_credentials SET counter=$2,last_used_at=now() WHERE credential_id=$1",
      [credential.credential_id, verification.authenticationInfo.newCounter],
    );
    return createSession(credential.user_id as string, context.secure, db);
  });
  return { verified: true, cookie };
}

export async function getPasskeyCount(userId: string): Promise<number> {
  const result = await pool.query("SELECT count(*)::int AS count FROM webauthn_credentials WHERE user_id=$1", [userId]);
  return Number(result.rows[0]?.count ?? 0);
}

export async function revokePasskeySession(request: Request): Promise<string> {
  const context = webAuthnRequestContext(request);
  const token = sessionToken(request);
  if (token) {
    await pool.query("UPDATE webauthn_sessions SET revoked_at=now() WHERE token_hash=$1 AND revoked_at IS NULL", [hashToken(token)]);
  }
  return passkeySessionCookie("", context.secure, 0);
}

export function webAuthnErrorResponse(error: unknown): Response {
  if (error instanceof WebAuthnError) {
    return webAuthnJsonResponse({ error: error.message, ...(error.code ? { code: error.code } : {}) }, { status: error.status });
  }
  if (error instanceof Error && error.message === "Sign in to continue.") {
    return webAuthnJsonResponse({ error: error.message }, { status: 401 });
  }
  console.error("WebAuthn request failed:", error instanceof Error ? error.message : "Unknown error");
  return webAuthnJsonResponse({ error: "Passkey request could not be completed. Please try again." }, { status: 400 });
}

export function webAuthnJsonResponse(body: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { ...init, headers });
}

import {
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";

export class PasskeyClientError extends Error {
  constructor(message: string, readonly code?: string) {
    super(message);
    this.name = "PasskeyClientError";
  }
}

async function readResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({})) as { error?: unknown; code?: unknown };
  if (!response.ok) {
    throw new PasskeyClientError(
      typeof payload.error === "string" ? payload.error : "Passkey request could not be completed.",
      typeof payload.code === "string" ? payload.code : undefined,
    );
  }
  return payload as T;
}

async function postJson<T>(url: string, body: unknown = {}): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return readResponse<T>(response);
}

export async function authenticateWithPasskey(): Promise<void> {
  const challenge = await postJson<{
    challengeId: string;
    options: PublicKeyCredentialRequestOptionsJSON;
  }>("/api/passkeys/authentication-options");
  const response = await startAuthentication({ optionsJSON: challenge.options });
  const result = await postJson<{ verified: boolean }>("/api/passkeys/authentication-verify", {
    challengeId: challenge.challengeId,
    response,
  });
  if (!result.verified) throw new PasskeyClientError("Passkey sign-in could not be verified.");
}

export async function registerPasskey(): Promise<number> {
  const challenge = await postJson<{
    challengeId: string;
    options: PublicKeyCredentialCreationOptionsJSON;
  }>("/api/passkeys/registration-options");
  const response = await startRegistration({ optionsJSON: challenge.options });
  const result = await postJson<{ verified: boolean; count: number }>("/api/passkeys/registration-verify", {
    challengeId: challenge.challengeId,
    response,
  });
  if (!result.verified) throw new PasskeyClientError("Passkey registration could not be verified.");
  return result.count;
}

export async function getRegisteredPasskeyCount(): Promise<number> {
  const response = await fetch("/api/passkeys/count", { credentials: "same-origin" });
  const result = await readResponse<{ count: number }>(response);
  return result.count;
}

export async function endPasskeySession(): Promise<void> {
  const response = await fetch("/api/passkeys/signout", {
    method: "POST",
    credentials: "same-origin",
  });
  await readResponse<{ signedOut: boolean }>(response);
}

export const PENDING_SIGNUP_KEY = "v5vault:pending-signup:v1";
export const VERIFY_EMAIL_PATH = "/sign-up/verify-email-address";
const MAX_AGE = 60 * 60 * 1000;

export interface PendingSignup {
  isVerifyingEmail: true;
  pendingEmail: string;
  updatedAt: number;
}
export interface SignupSnapshot {
  id?: string | undefined;
  status: string | null;
  emailAddress: string | null;
  unverifiedFields: readonly string[];
  verifications: {
    emailAddress: { strategy: string | null; status: string | null };
  };
}

// This is a UI recovery hint, never an authentication credential.
export function readPendingSignup(storage: Storage, now = Date.now()): PendingSignup | null {
  try {
    const data = JSON.parse(storage.getItem(PENDING_SIGNUP_KEY) ?? "null");
    if (data?.isVerifyingEmail !== true || typeof data.pendingEmail !== "string" ||
      !data.pendingEmail.includes("@") || data.pendingEmail.length > 254 ||
      typeof data.updatedAt !== "number" || !Number.isFinite(data.updatedAt) ||
      now - data.updatedAt > MAX_AGE || data.updatedAt > now + 60000) {
      storage.removeItem(PENDING_SIGNUP_KEY);
      return null;
    }
    return { isVerifyingEmail: true, pendingEmail: data.pendingEmail, updatedAt: data.updatedAt };
  } catch { return null; }
}
export function clearPendingSignup() {
  try { window.sessionStorage.removeItem(PENDING_SIGNUP_KEY); } catch { /* Clerk still owns recovery. */ }
}
export function pendingEmailFromSignup(signup: SignupSnapshot | null | undefined): string | null {
  if (!signup?.id || signup.status !== "missing_requirements" || !signup.emailAddress ||
    !signup.unverifiedFields.includes("email_address") ||
    signup.verifications.emailAddress.strategy !== "email_code" ||
    signup.verifications.emailAddress.status === "verified") return null;
  return signup.emailAddress;
}
export function savePendingSignup(storage: Storage, email: string) {
  try {
    storage.setItem(PENDING_SIGNUP_KEY, JSON.stringify({
      isVerifyingEmail: true, pendingEmail: email, updatedAt: Date.now(),
    } satisfies PendingSignup));
  } catch { /* Private-mode storage failures must not crash authentication. */ }
}
export function isRecoveryRoute(path: string) {
  return path === "/" || path === "/sign-in" || path === "/sign-up" ||
    path.startsWith("/sign-in/") || path.startsWith("/sign-up/");
}
export function isExpiredRecoveryError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ("status" in error && [401, 404, 410].includes(Number(error.status))) return true;
  const expiredCodes = ["resource_not_found", "sign_up_not_found", "sign_up_expired"];
  return "errors" in error && Array.isArray(error.errors) &&
    error.errors.some(item => item && typeof item === "object" && "code" in item && expiredCodes.includes(String(item.code)));
}

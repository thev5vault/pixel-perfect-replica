import { ADMIN_PERMISSIONS, type UserAccount } from "@/lib/account-types";

// Clerk-backed sessions use Clerk's live primary email. Native passkey sessions
// use the verification state captured from that same Clerk identity at sign-in.
const OWNER_EMAIL = "kieranroe23@hotmail.co.uk";
export function applyAdminPolicy<T extends UserAccount>(profile: T, primaryEmail?: {
  emailAddress: string;
  verification: { status: string } | null;
}): T {
  const email = primaryEmail?.emailAddress ?? profile.email;
  const verified = primaryEmail
    ? primaryEmail.verification?.status === "verified"
    : profile.email_verified === true;
  if (!verified || email.trim().toLowerCase() !== OWNER_EMAIL) {
    return { ...profile, role:profile.role==="dev_admin"?"civilian":profile.role,
      subscription_tier:profile.subscription_tier==="god_mode"?"free":profile.subscription_tier, permissions: [] };
  }
  // Derive rights afresh on every request. A changed/unverified address must
  // never retain a persisted admin role from an earlier login.
  return { ...profile, role: "dev_admin", subscription_tier: "god_mode", permissions: [...ADMIN_PERMISSIONS] };
}

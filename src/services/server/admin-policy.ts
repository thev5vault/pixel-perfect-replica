import { ADMIN_PERMISSIONS, type UserAccount } from "@/lib/account-types";

// This allowlist is evaluated ONLY after authenticating a real Clerk session
// and fetching its primary address from Clerk's server SDK.
const OWNER_EMAIL = "kieranroe23@hotmail.co.uk";
export function applyAdminPolicy<T extends UserAccount>(profile: T, primaryEmail?: {
  emailAddress: string;
  verification: { status: string } | null;
}): T {
  if (primaryEmail?.verification?.status !== "verified" ||
      primaryEmail.emailAddress.trim().toLowerCase() !== OWNER_EMAIL) {
    return { ...profile, role:profile.role==="dev_admin"?"civilian":profile.role,
      subscription_tier:profile.subscription_tier==="god_mode"?"free":profile.subscription_tier, permissions: [] };
  }
  // Derive rights afresh on every request. A changed/unverified address must
  // never retain a persisted admin role from an earlier login.
  return { ...profile, role: "dev_admin", subscription_tier: "god_mode", permissions: [...ADMIN_PERMISSIONS] };
}

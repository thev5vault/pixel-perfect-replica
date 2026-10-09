import type { AccountRole, SubscriptionTier, TierOverride } from "./account-types";

type AccountRoleSource = {
  role?: AccountRole | "admin";
  subscription_tier?: SubscriptionTier | "verified_workshop" | "admin";
  subscriptionTier?: SubscriptionTier | "verified_workshop" | "admin";
  permissions?: readonly string[];
  tier_override?: TierOverride | null;
  isAdmin?: boolean;
  isGodMode?: boolean;
};

export interface AccountRolePresentation {
  roleName: string;
  planName: string;
  badgeName: string;
  isAdmin: boolean;
  isWorkshop: boolean;
}

export function accountRolePresentation(user: AccountRoleSource): AccountRolePresentation {
  const tier = user.subscriptionTier ?? user.subscription_tier ?? "free";
  const isAdmin = Boolean(
    user.isAdmin || user.role === "dev_admin" || user.role === "admin" || user.permissions?.includes("all_access"),
  );
  const isGodMode = Boolean(user.isGodMode || tier === "god_mode" || tier === "admin");

  if (isAdmin || isGodMode) {
    return {
      roleName: "Platform Founder & Lead Developer",
      planName: "God Mode Active",
      badgeName: "God Mode",
      isAdmin: true,
      isWorkshop: false,
    };
  }

  switch (tier) {
    case "pro_diy":
      return { roleName: "Pro DIY Track & Service", planName: "Pro DIY Plan", badgeName: "Pro DIY", isAdmin: false, isWorkshop: false };
    case "pro_modder":
      return {
        roleName: "Pro Modder & Performance",
        planName: user.tier_override === "pro_modder_lifetime" ? "Pro Modder Plan · Lifetime" : "Pro Modder Plan",
        badgeName: user.tier_override === "pro_modder_lifetime" ? "Pro Modder · Lifetime" : "Pro Modder",
        isAdmin: false,
        isWorkshop: false,
      };
    case "verified_garage":
    case "verified_workshop":
      return { roleName: "Verified Workshop & Trade Specialist", planName: "Verified Workshop Plan", badgeName: "Verified Workshop", isAdmin: false, isWorkshop: true };
    default:
      return { roleName: "Private Driver", planName: "Basic Driver (Free)", badgeName: "Private Driver · Free", isAdmin: false, isWorkshop: false };
  }
}

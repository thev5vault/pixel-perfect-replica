import type { SubscriptionTier, UserAccount } from "./account-types";
import type { PlanKey } from "./v1-types";
export const PLAN_DEFINITIONS = {
  sales_pack: { name: "Certified Sales Pack", amount: 299, interval: null, tier: null, description: "A V5Vault provenance PDF and QR listing badge for one vehicle." },
  diy_monthly: { name: "Pro DIY", amount: 99, interval: "month", tier: "pro_diy", description: "Receipt storage, OEM parts and cost breakdowns. Existing Pro DIY option." },
  pro_monthly: { name: "Pro Modder / Collector", amount: 149, interval: "month", tier: "pro_modder", description: "Receipt photo/PDF storage, cost analytics, three active vehicles and the Modder's Vault." },
  pro_yearly: { name: "Pro Modder / Collector", amount: 1499, interval: "year", tier: "pro_modder", description: "The Collector plan, billed annually." },
  workshop_monthly: { name: "Verified Workshop", amount: 1299, interval: "month", tier: "verified_garage", description: "Garage Terminal, unlimited eligible workshop signatures and consented customer reminders. Verification required." },
} as const;
export const PLAN_KEYS = Object.keys(PLAN_DEFINITIONS) as PlanKey[];
export function vehicleLimit(user: Pick<UserAccount, "role" | "subscription_tier">) {
  if (user.role === "dev_admin") return Number.POSITIVE_INFINITY;
  return ["pro_modder", "verified_garage"].includes(user.subscription_tier) ? 3 : 1;
}
export function hasPaidStorage(tier: SubscriptionTier) { return tier !== "free"; }
export function gbp(pence: number) { return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100); }

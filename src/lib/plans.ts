import type { SubscriptionTier, UserAccount } from "./account-types";
import type { BillingInterval, PlanKey } from "./v1-types";
export const PLAN_DEFINITIONS = {
  sales_pack: { name: "Certified Sales Pack", amount: 299, interval: null, tier: null, description: "A V5Vault provenance PDF and QR listing badge for one vehicle." },
  diy_monthly: { name: "Pro DIY", amount: 99, interval: "month", tier: "pro_diy", description: "Receipt storage, OEM parts and cost breakdowns." },
  diy_yearly: { name: "Pro DIY", amount: 999, interval: "year", tier: "pro_diy", description: "Pro DIY features, billed annually." },
  pro_monthly: { name: "Pro Modder / Collector", amount: 149, interval: "month", tier: "pro_modder", description: "Receipt photo/PDF storage, cost analytics, three active vehicles and the Modder's Vault." },
  pro_yearly: { name: "Pro Modder / Collector", amount: 1499, interval: "year", tier: "pro_modder", description: "The Collector plan, billed annually." },
  workshop_monthly: { name: "Verified Workshop / Garage Pro", amount: 999, interval: "month", tier: "verified_garage", description: "30-day trial, unlimited workshop stamps, chips and local invoice OCR. Approval and VAT verification required." },
  workshop_yearly: { name: "Verified Workshop / Garage Pro", amount: 9999, interval: "year", tier: "verified_garage", description: "Annual workshop plan with a 30-day trial, unlimited stamps, chips and local invoice OCR. Approval and VAT verification required." },
} as const;
export const PLAN_KEYS = Object.keys(PLAN_DEFINITIONS) as PlanKey[];
export function planForBillingInterval(plan: PlanKey, interval: BillingInterval): PlanKey {
  if (plan === "sales_pack") return plan;
  const family = plan.startsWith("diy_") ? "diy" : plan.startsWith("workshop_") ? "workshop" : "pro";
  return `${family}_${interval === "year" ? "yearly" : "monthly"}` as PlanKey;
}
export function vehicleLimit(user: Pick<UserAccount, "role" | "subscription_tier">) {
  if (user.role === "dev_admin") return Number.POSITIVE_INFINITY;
  return ["pro_modder", "verified_garage"].includes(user.subscription_tier) ? 3 : 1;
}
export function isWorkshopTrialActive(
  user: Pick<UserAccount, "subscription_status" | "trial_expires_at">,
  now = Date.now(),
) {
  if (user.subscription_status !== "trialing" || !user.trial_expires_at) return false;
  const expiry = new Date(user.trial_expires_at).getTime();
  return Number.isFinite(expiry) && expiry > now;
}
export function canUseWorkshopFeatures(
  user: Pick<UserAccount, "role" | "status" | "garage_verified" | "vat_verified" | "subscription_tier" | "workshop_access_active">,
) {
  return user.role === "verified_garage"
    && user.status === "approved"
    && user.garage_verified
    && user.vat_verified === true
    && (user.workshop_access_active === true || user.subscription_tier === "verified_garage");
}
export function hasPaidStorage(tier: SubscriptionTier) { return tier !== "free"; }
export function gbp(pence: number) { return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100); }

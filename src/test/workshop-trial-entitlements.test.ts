import { describe, expect, it } from "vitest";
import { canUseWorkshopFeatures, isWorkshopTrialActive } from "@/lib/plans";

const now = Date.parse("2026-10-09T12:00:00.000Z");
const activeTrial = {
  subscription_status: "trialing" as const,
  trial_expires_at: "2026-10-10T00:00:00.000Z",
};
const approvedWorkshop = {
  role: "verified_garage" as const,
  status: "approved" as const,
  garage_verified: true,
  vat_verified: true,
  subscription_tier: "verified_garage" as const,
  workshop_access_active: false,
};

describe("workshop trial access", () => {
  it("recognizes an unexpired trial and rejects expired or non-trial subscriptions", () => {
    expect(isWorkshopTrialActive(activeTrial, now)).toBe(true);
    expect(isWorkshopTrialActive({ ...activeTrial, trial_expires_at: "2026-10-09T11:59:59.999Z" }, now)).toBe(false);
    expect(isWorkshopTrialActive({ ...activeTrial, subscription_status: "active" }, now)).toBe(false);
    expect(isWorkshopTrialActive({ ...activeTrial, trial_expires_at: "invalid" }, now)).toBe(false);
  });

  it("keeps trial and lifetime Pro entitlements separate from workshop approval", () => {
    expect(canUseWorkshopFeatures(approvedWorkshop)).toBe(true);
    expect(canUseWorkshopFeatures({ ...approvedWorkshop, workshop_access_active: true, subscription_tier: "pro_modder" })).toBe(true);
    expect(canUseWorkshopFeatures({ ...approvedWorkshop, status: "pending" })).toBe(false);
    expect(canUseWorkshopFeatures({ ...approvedWorkshop, vat_verified: false })).toBe(false);
    expect(canUseWorkshopFeatures({ ...approvedWorkshop, garage_verified: false })).toBe(false);
    expect(canUseWorkshopFeatures({ ...approvedWorkshop, subscription_tier: "pro_modder", workshop_access_active: false })).toBe(false);
  });
});

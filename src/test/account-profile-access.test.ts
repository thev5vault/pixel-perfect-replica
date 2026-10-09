import { describe, expect, it } from "vitest";
import { canEditWorkshopProfile } from "@/lib/account-profile";

const now = Date.parse("2026-10-09T12:00:00.000Z");

describe("workshop profile authorization", () => {
  it("allows active paid workshop accounts and unexpired workshop trials", () => {
    expect(canEditWorkshopProfile({
      role: "verified_garage",
      subscription_tier: "verified_garage",
      subscription_status: "active",
      trial_expires_at: null,
    }, now)).toBe(true);
    expect(canEditWorkshopProfile({
      role: "verified_garage",
      subscription_tier: "free",
      subscription_status: "trialing",
      trial_expires_at: "2026-10-10T00:00:00.000Z",
    }, now)).toBe(true);
  });

  it("denies expired or unpaid workshop profiles and users without workshop role", () => {
    expect(canEditWorkshopProfile({
      role: "verified_garage",
      subscription_tier: "free",
      subscription_status: "trialing",
      trial_expires_at: "2026-10-09T11:59:59.999Z",
    }, now)).toBe(false);
    expect(canEditWorkshopProfile({
      role: "verified_garage",
      subscription_tier: "verified_garage",
      subscription_status: "canceled",
      trial_expires_at: null,
    }, now)).toBe(false);
    expect(canEditWorkshopProfile({
      role: "civilian",
      subscription_tier: "verified_garage",
      subscription_status: "active",
      trial_expires_at: null,
    }, now)).toBe(false);
  });

  it("requires the all-access permission for the administrator override", () => {
    expect(canEditWorkshopProfile({
      role: "dev_admin",
      subscription_tier: "god_mode",
      subscription_status: "inactive",
      trial_expires_at: null,
      permissions: ["all_access"],
    }, now)).toBe(true);
    expect(canEditWorkshopProfile({
      role: "dev_admin",
      subscription_tier: "god_mode",
      subscription_status: "inactive",
      trial_expires_at: null,
      permissions: [],
    }, now)).toBe(false);
  });
});

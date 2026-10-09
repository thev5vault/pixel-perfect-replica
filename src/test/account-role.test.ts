import { describe, expect, it } from "vitest";
import { accountRolePresentation } from "@/lib/account-role";

describe("account role presentation", () => {
  it("maps the free and consumer subscription tiers to their account roles", () => {
    expect(accountRolePresentation({ subscription_tier: "free" })).toMatchObject({
      roleName: "Private Driver",
      planName: "Basic Driver (Free)",
      isAdmin: false,
      isWorkshop: false,
    });
    expect(accountRolePresentation({ subscriptionTier: "pro_diy" }).roleName)
      .toBe("Pro DIY Track & Service");
    expect(accountRolePresentation({ subscription_tier: "pro_modder" }).roleName)
      .toBe("Pro Modder & Performance");
  });

  it("recognizes verified workshop and legacy verified garage tiers", () => {
    expect(accountRolePresentation({ subscriptionTier: "verified_workshop" }).isWorkshop).toBe(true);
    expect(accountRolePresentation({ subscription_tier: "verified_garage" })).toMatchObject({
      roleName: "Verified Workshop & Trade Specialist",
      isWorkshop: true,
    });
  });

  it("maps system admin permissions and God Mode flags to the founder role", () => {
    for (const user of [
      { role: "dev_admin" as const },
      { permissions: ["all_access"] },
      { isAdmin: true },
      { isGodMode: true },
      { subscription_tier: "god_mode" as const },
    ]) {
      expect(accountRolePresentation(user)).toMatchObject({
        roleName: "Platform Founder & Lead Developer",
        planName: "God Mode Active",
        isAdmin: true,
        isWorkshop: false,
      });
    }
  });

  it("labels administrator-granted Pro Modder overrides as lifetime access", () => {
    expect(accountRolePresentation({
      subscription_tier: "pro_modder",
      tier_override: "pro_modder_lifetime",
    })).toMatchObject({
      roleName: "Pro Modder & Performance",
      planName: "Pro Modder Plan · Lifetime",
    });
  });
});

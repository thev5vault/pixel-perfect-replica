import { describe, expect, it } from "vitest";
import { canUseAiDocumentScan, scannedServiceDocumentSchema } from "@/services/server/document-scanner";

describe("AI service document scan access and output validation", () => {
  it("allows paid tiers, verified workshops and admins", () => {
    for (const tier of ["pro_diy", "pro_modder", "verified_workshop", "verified_garage"]) {
      expect(canUseAiDocumentScan({ subscription_tier: tier })).toBe(true);
    }
    expect(canUseAiDocumentScan({ role: "dev_admin", subscription_tier: "god_mode" })).toBe(true);
    expect(canUseAiDocumentScan({ isAdmin: true, subscription_tier: "free" })).toBe(true);
  });

  it("denies free, missing and unknown account tiers", () => {
    expect(canUseAiDocumentScan({ subscription_tier: "free" })).toBe(false);
    expect(canUseAiDocumentScan({})).toBe(false);
    expect(canUseAiDocumentScan({ subscription_tier: "trial" })).toBe(false);
  });

  it("accepts the documented structured extraction and rejects invented enum values", () => {
    const valid = {
      garageName: "Apex Motors",
      vatNumber: "GB123456789",
      date: "04/06/2026",
      mileage: 84210,
      category: "Full Service",
      totalCost: 249.99,
      workSummary: "Oil and filter changed",
    };
    expect(scannedServiceDocumentSchema.parse(valid)).toEqual(valid);
    expect(scannedServiceDocumentSchema.safeParse({ ...valid, category: "Something else" }).success).toBe(false);
    expect(scannedServiceDocumentSchema.parse({ ...valid, vatNumber: undefined }).vatNumber).toBeUndefined();
  });
});

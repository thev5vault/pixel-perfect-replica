import { describe, expect, it } from "vitest";
import { DEVELOPMENT_CLAIM_REFERENCE, resolveClaimReference, vehicleClaimPolicy } from "@/lib/vehicle-claim-policy";

describe("vehicle claim policy", () => {
  it("allows first-account binding only for LG57 VYF outside production", () => {
    expect(vehicleClaimPolicy("lg57 vyf", "development")).toBe("first_account");
    expect(vehicleClaimPolicy("LG57VYF", "test")).toBe("first_account");
    expect(vehicleClaimPolicy("LG57 VYF", "production")).toBe("v5c_review");
    expect(vehicleClaimPolicy("AB14 CDE", "development")).toBe("v5c_review");
  });

  it("supplies the development-only V5C fixture reference when missing", () => {
    for (const vrm of ["LG57 VYF", "AB14 CDE", "BUL 200"]) {
      expect(resolveClaimReference(vrm, "", "development")).toBe(DEVELOPMENT_CLAIM_REFERENCE);
      expect(resolveClaimReference(vrm, undefined, "test")).toBe(DEVELOPMENT_CLAIM_REFERENCE);
      expect(resolveClaimReference(vrm, undefined, "production")).toBe("");
    }
    expect(resolveClaimReference("LG57 VYF", "12345678901", "development")).toBe("12345678901");
  });
});

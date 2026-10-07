import { describe, expect, it } from "vitest";
import { vehicleClaimPolicy } from "@/lib/vehicle-claim-policy";

describe("vehicle claim policy", () => {
  it("allows first-account binding only for LG57 VYF outside production", () => {
    expect(vehicleClaimPolicy("lg57 vyf", "development")).toBe("first_account");
    expect(vehicleClaimPolicy("LG57VYF", "test")).toBe("first_account");
    expect(vehicleClaimPolicy("LG57 VYF", "production")).toBe("v5c_review");
    expect(vehicleClaimPolicy("AB14 CDE", "development")).toBe("v5c_review");
  });
});

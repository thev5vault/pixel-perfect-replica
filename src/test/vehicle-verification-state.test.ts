import { describe, expect, it } from "vitest";
import { hasVerifiedVehicleRegistration, REVERIFICATION_NOTICE } from "@/lib/vehicle-verification";

describe("VIN-anchored registration verification", () => {
  it("keeps history unverified until the explicit verified state is recorded", () => {
    expect(hasVerifiedVehicleRegistration("PENDING_VERIFICATION")).toBe(false);
    expect(hasVerifiedVehicleRegistration("RE_VERIFICATION_REQUIRED")).toBe(false);
    expect(hasVerifiedVehicleRegistration(undefined)).toBe(false);
    expect(hasVerifiedVehicleRegistration("VERIFIED")).toBe(true);
  });

  it("uses the same clear notice for a pending or changed logbook", () => {
    expect(REVERIFICATION_NOTICE).toBe(
      "Logbook or Plate Updated: Please enter your new VRM and 11-digit V5C reference number to re-verify ownership and unlock live export features.",
    );
  });
});

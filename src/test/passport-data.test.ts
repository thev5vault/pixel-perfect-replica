import { describe, expect, it } from "vitest";
import { dvsaPublicPassport } from "@/lib/passport-data";
import type { Vehicle } from "@/lib/vault-store";

describe("DVSA-only public passport", () => {
  it("publishes official vehicle and MOT fields without keeper or service history", () => {
    const vehicle: Vehicle = {
      vrm: "LG57VYF",
      vin: "WUAZZZ8EX8A800721",
      make: "Audi",
      model: "A4",
      year: 2007,
      registrationDate: "2007-09-17",
      colour: "Silver",
      fuelType: "Petrol",
      engineCapacity: 1968,
      odometer: 142417,
      odometerAvailable: true,
      motExpiry: "2027-02-16",
      motStatus: "PASSED",
      motHistorySource: "official",
      public_dvsa_enabled: true,
      source: "official",
      v5cDate: "2020-01-01",
      taxStatus: "Taxed",
      taxDueDate: "2027-01-01",
      motHistory: [{ date: "2026-02-16", result: "Pass", mileage: 142417, advisories: ["Tyre worn"] }],
      public_enabled: false,
    };

    const result = dvsaPublicPassport(vehicle, "https://v5vault.test");

    expect(result).toMatchObject({
      published: false,
      public_dvsa_only: true,
      services: [],
      mods: [],
      mot_history: [{ result: "Pass", mileage: 142417, advisories: ["Tyre worn"] }],
      vehicle: {
        vrm: "LG57VYF", make: "Audi", model: "A4", year: 2007,
        colour: "Silver", fuelType: "Petrol", engineCapacity: 1968,
        odometer: 142417, motExpiry: "2027-02-16", motHistorySource: "official", verification_tier: "government_data",
      },
    });
    expect(result.vehicle.vin).toBeUndefined();
    expect(result.vehicle.v5cDate).toBe("");
    expect(result.vehicle.taxStatus).toBeUndefined();
  });
});

import type { Vehicle, ServiceRecord, Modification } from "./vault-store";
import type { PublicPassport } from "./v1-types";
/** Public reports deliberately never include keeper identity, V5C secrets or raw receipts. */
export function passportData(vehicle: Vehicle, services: ServiceRecord[], mods: Modification[], baseUrl: string, sample: boolean, parts = true): PublicPassport {
  const { vrm, make, model, odometer, v5cDate, registrationDate, motExpiry, year, fuelType, colour, engineCapacity, taxStatus, taxDueDate, motStatus, motHistory, source, vin, odometerAvailable, verification_tier, is_scrapped } = vehicle;
  return {
    vehicle: { vrm, make, model, odometer, odometerAvailable, v5cDate, registrationDate, motExpiry, year, fuelType, colour, engineCapacity, taxStatus, taxDueDate, motStatus,
      vin: vin ? `•••••••••••${vin.slice(-6)}` : undefined, source, is_sample: sample,
      verification_tier: verification_tier ?? "provisional", is_scrapped: Boolean(is_scrapped) },
    services: services.map(s => ({
      id: s.id, vrm: s.vrm, date: s.date, mileage: s.mileage, category: s.category, description: s.description,
      items: s.items, garage: s.garage, verified: s.verified, is_verified_stamp: s.is_verified_stamp,
      stamp_authority: s.stamp_authority, vat_verified: s.vat_verified, is_sample: sample || s.is_sample,
      frozen_at: s.frozen_at, parts: parts ? s.parts : undefined, fluids: parts ? s.fluids : undefined,
      cost: parts ? s.cost : undefined, partsCost: parts ? s.partsCost : undefined, labourCost: parts ? s.labourCost : undefined,
    })),
    mods: mods.map(m => ({ id: m.id, vrm: m.vrm, name: m.name, category: m.category, installDate: m.installDate,
      installMileage: m.installMileage, gains: m.gains, notes: "", status: m.status, specs: m.specs, stage: m.stage, frozen_at: m.frozen_at })),
    mot_history: vehicle.motHistory ?? [],
    verified_stamp_count: sample?0:services.filter(s => s.is_verified_stamp && s.stamp_authority === "workshop" && s.vat_verified && !s.is_sample).length,
    generated_at: new Date().toISOString(), public_url: `${baseUrl}/v/${encodeURIComponent(vrm)}${sample ? "?sample=true" : ""}`,
    is_sample: sample, published: Boolean(vehicle.public_enabled),
  };
}

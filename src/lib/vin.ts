const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;

export function validateVIN(vin: unknown): vin is string {
  return typeof vin === "string" && VIN_PATTERN.test(vin.trim().toUpperCase());
}

export function normalizeVIN(vin: string) {
  return vin.trim().toUpperCase();
}

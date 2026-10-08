const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;

const WMI_MANUFACTURERS: Record<string, string> = {
  WUA: "Audi", WAU: "Audi", TRU: "Audi",
  WBA: "BMW", WBS: "BMW", WBY: "BMW", "4US": "BMW",
  WDD: "Mercedes-Benz", WDB: "Mercedes-Benz", WDC: "Mercedes-Benz", WDF: "Mercedes-Benz",
  WVW: "Volkswagen", WV1: "Volkswagen", WV2: "Volkswagen",
  WF0: "Ford", SAL: "Land Rover", SAJ: "Jaguar",
  W0L: "Vauxhall", W0V: "Vauxhall",
  YV1: "Volvo", YV4: "Volvo",
  SHH: "Honda", JHM: "Honda",
  SJN: "Nissan", JN1: "Nissan",
  SB1: "Toyota", JT1: "Toyota", JT3: "Toyota",
};

export function validateVIN(vin: unknown): vin is string {
  if (typeof vin !== "string") return false;
  const value = vin.trim().toUpperCase();
  if (!VIN_PATTERN.test(value)) return false;
  // The first character must identify a recognized VIN region. Known WMIs
  // below can additionally be checked against the vehicle make.
  return /^[1-9A-HJ-NPR-Z]/.test(value);
}

export function vinManufacturer(vin: unknown): string | undefined {
  if (typeof vin !== "string" || !validateVIN(vin)) return undefined;
  return WMI_MANUFACTURERS[vin.trim().toUpperCase().slice(0, 3)];
}

export function vinMatchesMake(vin: unknown, make: string): boolean {
  const manufacturer = vinManufacturer(vin);
  return !manufacturer || manufacturer.localeCompare(make.trim(), undefined, { sensitivity: "base" }) === 0;
}

export function normalizeVIN(vin: string) {
  return vin.trim().toUpperCase();
}

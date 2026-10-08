const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/;
const VIN_WEIGHTS = [8, 7, 6, 5, 4, 3, 2, 10, 0, 9, 8, 7, 6, 5, 4, 3, 2];
const VIN_CHARACTER_VALUES: Record<string, number> = {
  A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, G: 7, H: 8,
  J: 1, K: 2, L: 3, M: 4, N: 5, P: 7, R: 9,
  S: 2, T: 3, U: 4, V: 5, W: 6, X: 7, Y: 8, Z: 9,
};

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
  if (!/^[1-9A-HJ-NPR-Z]/.test(value)) return false;

  // ISO 3779 check digits are required for North American VINs. UK and
  // European VINs use the same 17-character format but do not universally
  // require a check digit in position 9.
  return !/^[1-5]/.test(value) || expectedVINCheckDigit(value) === value[8];
}

export function expectedVINCheckDigit(vin: unknown): string | undefined {
  if (typeof vin !== "string") return undefined;
  const value = vin.trim().toUpperCase();
  if (!VIN_PATTERN.test(value)) return undefined;

  const weightedSum = [...value].reduce((sum, character, index) => {
    const characterValue = Number.isNaN(Number(character))
      ? VIN_CHARACTER_VALUES[character]
      : Number(character);
    return sum + characterValue * (VIN_WEIGHTS[index] ?? 0);
  }, 0);
  const remainder = weightedSum % 11;
  return remainder === 10 ? "X" : String(remainder);
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

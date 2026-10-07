import type { MotReading, Vehicle } from "@/lib/vault-store";

export interface VesData {
  registrationNumber?: string;
  make?: string;
  yearOfManufacture?: number;
  fuelType?: string;
  colour?: string;
  motStatus?: string;
  dateOfLastV5CIssued?: string;
  engineCapacity?: number;
  taxStatus?: string;
  taxDueDate?: string;
}

export interface MotData {
  make?: string;
  model?: string;
  manufactureDate?: string;
  fuelType?: string;
  primaryColour?: string;
  vin?: string;
  motTests?: {
    completedDate: string;
    testResult: string;
    expiryDate?: string;
    odometerValue?: string;
    odometerUnit?: string | null;
    odometerResultType?: string;
    defects?: { text: string; type?: string }[];
  }[];
}

/** Never fabricate dates or mileage when an official provider omits them. */
export function parseVehicleData(vrm: string, ves: VesData, mot: MotData): Vehicle {
  const tests = [...(mot.motTests ?? [])].sort((a, b) => a.completedDate.localeCompare(b.completedDate));
  const motHistory: MotReading[] = tests.map((test) => {
    const raw = Number(test.odometerValue);
    const mileage = test.odometerValue && Number.isFinite(raw) && raw >= 0 && test.odometerUnit && (!test.odometerResultType || test.odometerResultType === "READ")
      ? Math.round(raw * (test.odometerUnit === "KM" ? 0.621371 : 1))
      : undefined;
    return {
      date: test.completedDate.slice(0, 10),
      ...(mileage !== undefined ? { mileage } : {}),
      result: test.testResult === "PASSED" ? "Pass" : "Fail",
      advisories: (test.defects ?? []).map((d) => `${d.type ? `${d.type}: ` : ""}${d.text}`),
    };
  });
  const latest = tests.at(-1);
  const latestReading = [...motHistory].reverse().find((m) => m.mileage !== undefined);
  const year = ves.yearOfManufacture ?? (mot.manufactureDate ? Number(mot.manufactureDate.slice(0, 4)) : undefined);
  return {
    vrm, make: ves.make ?? mot.make ?? "Unknown make", model: mot.model ?? "Model unavailable",
    odometer: latestReading?.mileage ?? 0,
    v5cDate: ves.dateOfLastV5CIssued ?? "",
    motExpiry: latest?.expiryDate ?? "",
    motStatus: latest?.testResult ?? ves.motStatus ?? "Unknown",
    ...(year ? { year } : {}),
    ...(ves.fuelType ?? mot.fuelType ? { fuelType: ves.fuelType ?? mot.fuelType } : {}),
    ...(ves.colour ?? mot.primaryColour ? { colour: ves.colour ?? mot.primaryColour } : {}),
    motHistory, source: "official",
    engineCapacity: ves.engineCapacity, taxStatus: ves.taxStatus, taxDueDate: ves.taxDueDate,
    vin: mot.vin,
  };
}

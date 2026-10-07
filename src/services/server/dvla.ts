import { randomUUID } from "node:crypto";
import { parseVehicleData, type VesData, type MotData } from "../vehicle-data";
import type { Vehicle } from "@/lib/vault-store";
import { LG57_VYF, LG57_VYF_VIN, normalizeRegistration } from "@/lib/vehicle-claim-policy";
import { normalizeVIN, validateVIN } from "@/lib/vin";
import { pool } from "./db";

let tokenCache: { token: string; expires: number } | undefined;

async function jsonRequest<T>(url: string, init: RequestInit, provider: string): Promise<T> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
  if (!response.ok) {
    throw new Error(`${provider} lookup failed (${response.status}). ${response.status === 404 ? "Vehicle not found." : "Please check API configuration or try again later."}`);
  }
  return response.json() as Promise<T>;
}

async function motToken() {
  if (tokenCache && tokenCache.expires > Date.now()) return tokenCache.token;
  const tokenUrl = process.env["MOT_HISTORY_TOKEN_URL"]!;
  if (!tokenUrl.startsWith("https://login.microsoftonline.com/")) throw new Error("MOT token URL must be the issued Microsoft OAuth endpoint.");
  const data = await jsonRequest<{ access_token: string; expires_in: number }>(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: process.env["MOT_HISTORY_CLIENT_ID"]!,
      client_secret: process.env["MOT_HISTORY_CLIENT_SECRET"]!,
      scope: process.env["MOT_HISTORY_SCOPE"] ?? "https://tapi.dvsa.gov.uk/.default",
    }),
  }, "MOT authentication");
  if (!data.access_token) throw new Error("MOT authentication did not return an access token.");
  tokenCache = { token: data.access_token, expires: Date.now() + Math.max(0, data.expires_in - 60) * 1000 };
  return data.access_token;
}

export const samples: Record<string, Vehicle> = {
  AB14CDE: {
    vrm: "AB14CDE", make: "Audi", model: "A4 2.0 TDI", year: 2014, fuelType: "Diesel",
    vin: "WAUZZZ8K9EA000001",
    odometer: 87420, v5cDate: "2019-03-15", motExpiry: "2026-11-18", motStatus: "PASSED", source: "demo",
    motHistory: [
      { date: "2023-11-15", mileage: 80480, result: "Pass" },
      { date: "2025-11-18", mileage: 86900, result: "Pass", advisories: ["Sample advisory: front tyre approaching wear limit"] },
    ],
  },
  BUL200: {
    vrm: "BUL200", make: "Volkswagen", model: "Golf GTI", year: 2018, fuelType: "Petrol",
    vin: "WVWZZZ1KZJW000001",
    odometer: 46210, v5cDate: "2022-06-10", motExpiry: "2027-02-12", motStatus: "PASSED", source: "demo",
    motHistory: [
      { date: "2024-02-10", mileage: 35100, result: "Pass" },
      { date: "2025-02-11", mileage: 40560, result: "Fail", advisories: ["Sample defect: worn front brake pads"] },
      { date: "2025-02-12", mileage: 40560, result: "Pass" },
      { date: "2026-02-12", mileage: 46210, result: "Pass" },
    ],
  },
};

const suppliedVehicleRecords: Record<string, Vehicle> = {
  [LG57_VYF]: {
    vrm: LG57_VYF,
    vin: LG57_VYF_VIN,
    make: "Audi",
    model: "A4",
    year: 2007,
    registrationDate: "2007-09-17",
    colour: "Silver",
    fuelType: "Petrol",
    motExpiry: "2027-02-16",
    motStatus: "Unknown",
    odometer: 0,
    odometerAvailable: false,
    v5cDate: "",
    motHistory: [],
    source: "user-provided",
  },
};

async function persistSuppliedVehicle(vehicle: Vehicle) {
  const vrm = normalizeRegistration(vehicle.vrm);
  const vin = normalizeVIN(vehicle.vin ?? "");
  if (vrm !== LG57_VYF || !validateVIN(vin)) return;

  const existing = (await pool.query(
    "SELECT id,vin,vrm,data FROM vehicles WHERE vrm=$1 OR vin=$2 LIMIT 1",
    [vrm, vin],
  )).rows[0];
  if (existing && (existing.vin !== vin || existing.vrm !== vrm)) {
    throw new Error("LG57 VYF is already associated with a different vehicle identity. Manual review is required.");
  }

  const merge = JSON.stringify({
    vrm, vin, make: vehicle.make, model: vehicle.model, year: vehicle.year,
    registrationDate: vehicle.registrationDate, colour: vehicle.colour,
    fuelType: vehicle.fuelType, motExpiry: vehicle.motExpiry, source: vehicle.source,
  });
  if (existing) {
    if (existing.data?.source === "official") return;
    await pool.query(
      "UPDATE vehicles SET data=data || $1::jsonb WHERE vin=$2 AND vrm=$3",
      [merge, vin, vrm],
    );
    return;
  }
  await pool.query(
    `INSERT INTO vehicles(id,vin,vrm,data,status,is_sample)
     VALUES($1,$2,$3,$4,'pending',false) ON CONFLICT(vin) DO NOTHING`,
    [randomUUID(), vin, vrm, JSON.stringify(vehicle)],
  );
}

export function lookupMockRegistration(input: string) {
  const vrm = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const vehicle = suppliedVehicleRecords[vrm] ?? samples[vrm];
  if (!vehicle) throw new Error("Live lookup is not configured. Sample lookup is available for AB14 CDE and BUL 200; LG57 VYF has a separate supplied record.");
  return {
    vehicle: { ...vehicle },
    notice: vehicle.source === "user-provided"
      ? "Vehicle details supplied for LG57 VYF. No live DVLA/DVSA lookup was performed; these values are unverified."
      : "Development demo sample vehicle only. These mock specifications are not an official DVLA/DVSA lookup.",
  };
}

export async function lookupRegistration(vrm: string): Promise<{ vehicle: Vehicle; notice: string }> {
  const vesKey = process.env["DVLA_VES_API_KEY"];
  const motKeys = ["MOT_HISTORY_API_KEY", "MOT_HISTORY_CLIENT_ID", "MOT_HISTORY_CLIENT_SECRET", "MOT_HISTORY_TOKEN_URL"];
  const hasMot = motKeys.every((key) => !!process.env[key]);
  if (motKeys.some((key) => !!process.env[key]) && !hasMot) {
    throw new Error("MOT API configuration is incomplete. Set all four MOT credentials in Replit Secrets.");
  }
  if (!vesKey && !hasMot) {
    const supplied = suppliedVehicleRecords[normalizeRegistration(vrm)];
    if (supplied) {
      await persistSuppliedVehicle(supplied);
      return {
        vehicle: { ...supplied },
        notice: "Vehicle details supplied for LG57 VYF. No live DVLA/DVSA lookup was performed; these values are unverified.",
      };
    }
    return lookupMockRegistration(vrm);
  }
  const [ves, mot] = await Promise.all([
    vesKey ? jsonRequest<VesData>("https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles", {
      method: "POST", headers: { "Content-Type": "application/json", "x-api-key": vesKey },
      body: JSON.stringify({ registrationNumber: vrm }),
    }, "DVLA VES") : Promise.resolve({} as VesData),
    hasMot ? motToken().then((token) => jsonRequest<MotData>(
      `https://history.mot.api.gov.uk/v1/trade/vehicles/registration/${encodeURIComponent(vrm)}`,
      { headers: { Authorization: `Bearer ${token}`, "X-API-Key": process.env["MOT_HISTORY_API_KEY"]! } },
      "MOT History",
    )) : Promise.resolve({} as MotData),
  ]);
  let vehicle = parseVehicleData(vrm, ves, mot);
  if (mot.vin && validateVIN(normalizeVIN(mot.vin))) vehicle.vin = normalizeVIN(mot.vin);
  if (normalizeRegistration(vrm) === LG57_VYF) {
    const supplied = suppliedVehicleRecords[LG57_VYF]!;
    if (vehicle.vin && normalizeVIN(vehicle.vin) !== supplied.vin) {
      throw new Error("The official lookup VIN differs from the supplied LG57 VYF identity. Manual review is required.");
    }
    const officialComplete = Boolean(vehicle.vin && vehicle.make !== "Unknown make" &&
      vehicle.model !== "Model unavailable" && vehicle.motExpiry);
    vehicle = {
      ...supplied,
      ...vehicle,
      vin: vehicle.vin || supplied.vin,
      registrationDate: vehicle.registrationDate || supplied.registrationDate,
      model: vehicle.model === "Model unavailable" ? supplied.model : vehicle.model,
      colour: vehicle.colour || supplied.colour,
      fuelType: vehicle.fuelType || supplied.fuelType,
      motExpiry: vehicle.motExpiry || supplied.motExpiry,
      odometerAvailable: vehicle.odometerAvailable ?? supplied.odometerAvailable,
      source: officialComplete ? "official" : "user-provided",
    };
    await persistSuppliedVehicle(vehicle);
  }
  return { vehicle, notice: hasMot && vesKey ? "Vehicle and MOT history loaded from official APIs." : "Vehicle loaded. Some fields are unavailable because only one official API is configured." };
}

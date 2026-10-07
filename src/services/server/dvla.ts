import { parseVehicleData, type VesData, type MotData } from "../vehicle-data";
import type { Vehicle } from "@/lib/vault-store";

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
    odometer: 87420, v5cDate: "2019-03-15", motExpiry: "2026-11-18", motStatus: "PASSED", source: "demo",
    motHistory: [
      { date: "2023-11-15", mileage: 80480, result: "Pass" },
      { date: "2025-11-18", mileage: 86900, result: "Pass", advisories: ["Sample advisory: front tyre approaching wear limit"] },
    ],
  },
  BUL200: {
    vrm: "BUL200", make: "Volkswagen", model: "Golf GTI", year: 2018, fuelType: "Petrol",
    odometer: 46210, v5cDate: "2022-06-10", motExpiry: "2027-02-12", motStatus: "PASSED", source: "demo",
    motHistory: [
      { date: "2024-02-10", mileage: 35100, result: "Pass" },
      { date: "2025-02-11", mileage: 40560, result: "Fail", advisories: ["Sample defect: worn front brake pads"] },
      { date: "2025-02-12", mileage: 40560, result: "Pass" },
      { date: "2026-02-12", mileage: 46210, result: "Pass" },
    ],
  },
};

export async function lookupRegistration(vrm: string): Promise<{ vehicle: Vehicle; notice: string }> {
  const vesKey = process.env["DVLA_VES_API_KEY"];
  const motKeys = ["MOT_HISTORY_API_KEY", "MOT_HISTORY_CLIENT_ID", "MOT_HISTORY_CLIENT_SECRET", "MOT_HISTORY_TOKEN_URL"];
  const hasMot = motKeys.every((key) => !!process.env[key]);
  if (motKeys.some((key) => !!process.env[key]) && !hasMot) {
    throw new Error("MOT API configuration is incomplete. Set all four MOT credentials in Replit Secrets.");
  }
  if (!vesKey && !hasMot) {
    const sample = samples[vrm];
    if (!sample) throw new Error("Live lookup is not configured. Try sample plate AB14 CDE or BUL 200.");
    return { vehicle: sample, notice: "Sample vehicle attached — demo data, not an official DVLA lookup." };
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
  return { vehicle: parseVehicleData(vrm, ves, mot), notice: hasMot && vesKey ? "Vehicle and MOT history loaded from official APIs." : "Vehicle loaded. Some fields are unavailable because only one official API is configured." };
}

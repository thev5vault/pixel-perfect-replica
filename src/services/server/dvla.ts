import { randomUUID } from "node:crypto";
import { parseVehicleData, type VesData, type MotData } from "../vehicle-data";
import type { Vehicle } from "@/lib/vault-store";
import { LG57_VYF, LG57_VYF_VIN, normalizeRegistration } from "@/lib/vehicle-claim-policy";
import { normalizeVIN, validateVIN, vinMatchesMake } from "@/lib/vin";
import { pool } from "./db";

let legacyTokenCache: { token: string; expires: number } | undefined;
let dvsaTokenCache: { token: string; expires: number } | undefined;
let dvsaTokenRequest: Promise<string> | undefined;

function cleanDvsaEnv(value: string | undefined): string {
  return (value ?? "").trim().replace(/^["']|["']$/g, "").trim();
}

function redactDvsaDiagnostic(value: unknown, secrets: string[]): string | undefined {
  if (typeof value !== "string") return undefined;
  let safe = value.slice(0, 1200);
  for (const secret of secrets) {
    if (!secret) continue;
    safe = safe.split(secret).join("[REDACTED]");
    const encoded = new URLSearchParams({ value: secret }).toString().slice("value=".length);
    safe = safe.split(encoded).join("[REDACTED]");
  }
  return safe;
}

async function jsonRequest<T>(url: string, init: RequestInit, provider: string): Promise<T> {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
  if (!response.ok) {
    throw new Error(`${provider} lookup failed (${response.status}). ${response.status === 404 ? "Vehicle not found." : "Please check API configuration or try again later."}`);
  }
  return response.json() as Promise<T>;
}

async function motToken() {
  if (legacyTokenCache && legacyTokenCache.expires > Date.now()) return legacyTokenCache.token;
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
  legacyTokenCache = { token: data.access_token, expires: Date.now() + Math.max(0, data.expires_in - 60) * 1000 };
  return data.access_token;
}

async function dvsaAccessToken() {
  if (dvsaTokenCache && dvsaTokenCache.expires > Date.now()) return dvsaTokenCache.token;
  if (dvsaTokenRequest) return dvsaTokenRequest;
  const tokenUrl = cleanDvsaEnv(process.env["DVSA_TOKEN_URL"]);
  const clientId = cleanDvsaEnv(process.env["DVSA_CLIENT_ID"]);
  const clientSecret = cleanDvsaEnv(process.env["DVSA_CLIENT_SECRET"]);
  const scope = cleanDvsaEnv(process.env["DVSA_SCOPE_URL"]);
  if (!tokenUrl || !clientId || !clientSecret || !scope) {
    throw new Error("DVSA OAuth configuration is incomplete.");
  }
  if (!tokenUrl.startsWith("https://login.microsoftonline.com/")) {
    throw new Error("DVSA token URL must be the issued Microsoft OAuth endpoint.");
  }
  const tokenParams = new URLSearchParams();
  tokenParams.append("grant_type", "client_credentials");
  tokenParams.append("client_id", clientId);
  tokenParams.append("client_secret", clientSecret);
  tokenParams.append("scope", scope);
  dvsaTokenRequest = (async () => {
    const response = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: tokenParams.toString(),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      if (response.status === 400 || response.status === 401) {
        const body: unknown = await response.json().catch(() => null);
        const detail = body && typeof body === "object" ? body as Record<string, unknown> : {};
        const secrets = [clientId, clientSecret, tokenUrl, scope];
        const error = redactDvsaDiagnostic(detail["error"], secrets);
        const errorDescription = redactDvsaDiagnostic(detail["error_description"], secrets);
        const errorCodes = Array.isArray(detail["error_codes"])
          ? detail["error_codes"].filter((code): code is number => typeof code === "number").slice(0, 10)
          : undefined;
        console.error("[DVSA OAuth] Token request rejected", JSON.stringify({
          status: response.status,
          ...(error ? { error } : {}),
          ...(errorDescription ? { error_description: errorDescription } : {}),
          ...(errorCodes ? { error_codes: errorCodes } : {}),
        }));
      }
      throw new Error(`DVSA authentication lookup failed (${response.status}). Please check API configuration or try again later.`);
    }
    const tokenResponse = await response.json() as { access_token?: string; expires_in?: number };
    if (!tokenResponse.access_token || !Number.isFinite(tokenResponse.expires_in)) {
      throw new Error("DVSA authentication returned an invalid access token.");
    }
    const lifetimeSeconds = Math.min(tokenResponse.expires_in!, 50 * 60);
    dvsaTokenCache = { token: tokenResponse.access_token, expires: Date.now() + Math.max(1, lifetimeSeconds - 30) * 1000 };
    return tokenResponse.access_token;
  })();
  try {
    return await dvsaTokenRequest;
  } finally {
    dvsaTokenRequest = undefined;
  }
}

function clearDvsaToken(token: string) {
  if (dvsaTokenCache?.token === token) dvsaTokenCache = undefined;
}

export const samples: Record<string, Vehicle> = {
  AB14CDE: {
    vrm: "AB14CDE", make: "Audi", model: "A4 2.0 TDI", year: 2014, fuelType: "Diesel",
    vin: "WAUZZZ8K9EA000001",
    odometer: 87420, v5cDate: "2019-03-15", motExpiry: "2026-11-18", motStatus: "PASSED", source: "demo",
    verification_tier: "provisional",
    motHistory: [
      { date: "2023-11-15", mileage: 80480, result: "Pass" },
      { date: "2025-11-18", mileage: 86900, result: "Pass", advisories: ["Sample advisory: front tyre approaching wear limit"] },
    ],
  },
  BUL200: {
    vrm: "BUL200", make: "Volkswagen", model: "Golf GTI", year: 2018, fuelType: "Petrol",
    vin: "WVWZZZ1KZJW000001",
    odometer: 46210, v5cDate: "2022-06-10", motExpiry: "2027-02-12", motStatus: "PASSED", source: "demo",
    verification_tier: "provisional",
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
    verification_tier: "provisional",
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
      "UPDATE vehicles SET data=data || $1::jsonb,verification_tier='provisional' WHERE vin=$2 AND vrm=$3",
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
  if (!vehicle) throw new Error("Live lookup is not configured. Sample lookup is available for AB14 CDE and BUL 200; LG57 VYF has a separate supplied record. DVSA Live Sync pending activation — manual service entry active");
  return {
    vehicle: { ...vehicle, verification_tier: "provisional" as const },
    notice: vehicle.source === "user-provided"
      ? "Vehicle details supplied for LG57 VYF. No live DVLA/DVSA lookup was performed; these values are unverified."
      : "Development demo sample vehicle only. These mock specifications are not an official DVLA/DVSA lookup.",
  };
}

async function lookupLegacyGovernmentRegistration(vrm: string): Promise<{ vehicle: Vehicle; notice: string }> {
  const vesKey = process.env["DVLA_VES_API_KEY"];
  const motKeys = ["MOT_HISTORY_API_KEY", "MOT_HISTORY_CLIENT_ID", "MOT_HISTORY_CLIENT_SECRET", "MOT_HISTORY_TOKEN_URL"];
  const hasMot = motKeys.every((key) => !!process.env[key]);
  if (motKeys.some((key) => !!process.env[key]) && !hasMot) {
    throw new Error("MOT API configuration is incomplete. DVSA Live Sync pending activation — manual service entry active");
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
  const [vesResult, motResult] = await Promise.allSettled([
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
  const ves = vesResult.status === "fulfilled" ? vesResult.value : {};
  const mot = motResult.status === "fulfilled" ? motResult.value : {};
  const failedProviders = [
    vesKey && vesResult.status === "rejected" ? "DVLA VES" : undefined,
    hasMot && motResult.status === "rejected" ? "DVSA MOT" : undefined,
  ].filter((provider): provider is string => Boolean(provider));
  const configuredProviders = [vesKey ? "DVLA VES" : undefined, hasMot ? "DVSA MOT" : undefined].filter(Boolean);
  const successfulProviders = configuredProviders.filter((provider) => !failedProviders.includes(provider!));
  if (successfulProviders.length === 0) {
    const failures = [
      vesKey && vesResult.status === "rejected" ? vesResult.reason : undefined,
      hasMot && motResult.status === "rejected" ? motResult.reason : undefined,
    ].filter(Boolean);
    if (failures.length === 1 && failures[0] instanceof Error) throw failures[0];
    throw new Error("DVSA Live Sync pending activation — manual service entry active");
  }
  let vehicle = parseVehicleData(vrm, ves, mot);
  if (mot.vin && validateVIN(normalizeVIN(mot.vin))) vehicle.vin = normalizeVIN(mot.vin);
  if (vehicle.vin && !vinMatchesMake(vehicle.vin, vehicle.make)) {
    throw new Error("The VIN manufacturer prefix does not match the government vehicle make. Manual review is required.");
  }
  vehicle.verification_tier = vehicle.vin && validateVIN(vehicle.vin) ? "government_data" : "provisional";
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
  const notice = failedProviders.length
    ? `Vehicle details loaded from ${successfulProviders.join(" and ")}. ${failedProviders.join(" and ")} is unavailable; review any missing details manually.`
    : hasMot && vesKey
      ? "Vehicle and MOT history loaded from official APIs."
      : "Vehicle loaded. Some fields are unavailable because only one official API is configured.";
  return { vehicle, notice };
}

async function lookupDvsa(vrm: string, apiKey: string): Promise<{ vehicle: Vehicle; notice: string }> {
  const url = `https://history.mot.api.gov.uk/v1/trade/vehicles/registration/${encodeURIComponent(vrm)}`;
  let token = await dvsaAccessToken();
  let response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, "X-API-Key": apiKey, Accept: "application/json" },
    signal: AbortSignal.timeout(15000),
  });
  if (response.status === 401) {
    clearDvsaToken(token);
    token = await dvsaAccessToken();
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, "X-API-Key": apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
  }
  if (!response.ok) {
    throw new Error(`DVSA MOT lookup failed (${response.status}). ${response.status === 404 ? "Vehicle not found." : "Please try again later."}`);
  }
  const payload = await response.json() as MotData | MotData[];
  const mot = Array.isArray(payload) ? payload[0] : payload;
  if (!mot) throw new Error("The DVSA lookup returned no vehicle record.");
  const vehicle = parseVehicleData(vrm, {}, mot);
  if (vehicle.vin && validateVIN(vehicle.vin) && !vinMatchesMake(vehicle.vin, vehicle.make)) {
    throw new Error("The DVSA VIN manufacturer prefix does not match the returned make. Manual review is required.");
  }
  vehicle.verification_tier = vehicle.vin && validateVIN(vehicle.vin) ? "government_data" : "provisional";
  if (normalizeRegistration(vrm) === LG57_VYF) {
    const supplied = suppliedVehicleRecords[LG57_VYF]!;
    if (vehicle.vin && validateVIN(vehicle.vin) && normalizeVIN(vehicle.vin) !== supplied.vin) {
      throw new Error("The official lookup VIN differs from the saved LG57 VYF identity. Manual review is required.");
    }
    Object.assign(vehicle, {
      ...supplied,
      ...vehicle,
      vin: vehicle.vin || supplied.vin,
      model: vehicle.model === "Model unavailable" ? supplied.model : vehicle.model,
      registrationDate: supplied.registrationDate,
      colour: vehicle.colour || supplied.colour,
      fuelType: vehicle.fuelType || supplied.fuelType,
      motExpiry: vehicle.motExpiry || supplied.motExpiry,
      source: vehicle.vin && vehicle.motExpiry ? "official" : "user-provided",
      motHistorySource: (vehicle.motHistory ?? []).length ? "official" : "user-provided",
      verification_tier: vehicle.vin && vehicle.motExpiry ? "government_data" : "provisional",
    });
  }
  return { vehicle, notice: "Vehicle and MOT history loaded from the enabled DVSA API. Values reflect the source response." };
}

/** Use official DVSA data when credentials are present; samples remain clearly labelled. */
export async function getVehicleData(inputVrm: string): Promise<{ vehicle: Vehicle; notice: string }> {
  const vrm = normalizeRegistration(inputVrm);
  const dvsaApiKey = cleanDvsaEnv(process.env["DVSA_API_KEY"]);
  const dvsaConfigured = Boolean(dvsaApiKey);
  if (process.env["GOV_API_ENABLED"] !== "true" && !dvsaConfigured) {
    const supplied = suppliedVehicleRecords[vrm];
    if (supplied) {
      await persistSuppliedVehicle(supplied);
      return {
        vehicle: { ...supplied },
        notice: "Vehicle details were supplied for this record. No live DVLA/DVSA lookup was performed; values are unverified.",
      };
    }
    return lookupMockRegistration(vrm);
  }

  const dvsaKey = dvsaApiKey;
  if (dvsaKey) {
    try {
      return await lookupDvsa(vrm, dvsaKey);
    } catch (error) {
      if (error instanceof Error && /VIN manufacturer prefix|VIN differs from/i.test(error.message)) throw error;
      // Keep only known development fixtures as a clearly labelled fallback;
      // never invent official vehicle identity for an arbitrary VRM.
      if (/(404|429|5\d\d)/.test(error instanceof Error ? error.message : "")) {
        try {
          const sample = lookupMockRegistration(vrm);
          return {
            ...sample,
            notice: `${sample.notice} Live DVSA lookup was unavailable; this is not official data.`,
          };
        } catch {
          // Unknown registrations must not be populated with fictional specifications.
        }
      }
      throw new Error(`${error instanceof Error ? error.message : "DVSA lookup failed."} DVSA Live Sync pending activation — manual service entry active`);
    }
  }
  const legacyConfigured = Boolean(process.env["DVLA_VES_API_KEY"] ||
    process.env["MOT_HISTORY_API_KEY"] || process.env["MOT_HISTORY_CLIENT_ID"] ||
    process.env["MOT_HISTORY_CLIENT_SECRET"] || process.env["MOT_HISTORY_TOKEN_URL"]);
  if (!legacyConfigured) return lookupMockRegistration(vrm);
  try {
    return await lookupLegacyGovernmentRegistration(vrm);
  } catch (error) {
    if (error instanceof Error && /VIN manufacturer prefix|VIN differs from/i.test(error.message)) throw error;
    throw new Error(`${error instanceof Error ? error.message : "Government lookup failed."} DVSA Live Sync pending activation — manual service entry active`);
  }
}

export const lookupRegistration = getVehicleData;

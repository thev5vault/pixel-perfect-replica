import { randomUUID } from "node:crypto";
import type { ServiceCategory, Vehicle } from "@/lib/vault-store";
import { normalizeVIN, validateVIN, vinMatchesMake } from "@/lib/vin";
import { currentUser, requireGarage, createService } from "./accounts";
import { pool } from "./db";
import { getVehicleData } from "./dvla";
import { enforceAnonymousLookupLimit } from "./rateLimit";

const normalizeVRM = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");

export async function mockVehicleLookup(vrm: string, request: Request, forceRefresh = false) {
  let user;
  try {
    user = await currentUser(request);
  } catch {
    // Requests without a usable session follow the anonymous quota.
  }
  if (!user) enforceAnonymousLookupLimit(request, false);
  if (forceRefresh) {
    if (!user) throw new Error("Sign in to refresh vehicle specifications.");
    await requireGarage(request);
  }
  return getVehicleData(vrm, { forceRefresh });
}

export async function createVehicleByVIN(input: {
  vrm: string;
  vin: string;
  make: string;
  model: string;
  year: number;
  odometer: number;
  motExpiry: string;
}) {
  const user = await currentUser();
  if (!user.email_verified) throw new Error("Verify your email before adding a vehicle.");
  const vrm = normalizeVRM(input.vrm);
  const vin = normalizeVIN(input.vin);
  if (!/^[A-Z0-9]{2,8}$/.test(vrm)) throw new Error("Enter a valid UK vehicle registration.");
  if (!validateVIN(vin)) throw new Error("VIN must contain 17 characters and exclude I, O and Q.");
  if (!vinMatchesMake(vin,input.make)) throw new Error("The VIN manufacturer prefix does not match the selected vehicle make.");
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const collision = (await client.query("SELECT id,vin,is_sample,owner_user_id FROM vehicles WHERE vrm=$1 FOR UPDATE", [vrm])).rows[0];
    if (collision?.vin && collision.vin !== vin) throw new Error("That registration is already linked to a different VIN.");
    const existing = (await client.query("SELECT * FROM vehicles WHERE vin=$1 FOR UPDATE", [vin])).rows[0];
    if (existing?.is_sample) throw new Error("Development sample vehicles are read-only.");
    if (existing?.is_scrapped) throw new Error("This vehicle is marked as scrapped. Its passport is read-only.");
    if (existing?.owner_user_id && existing.owner_user_id !== user.id && user.role !== "dev_admin") {
      throw new Error("This VIN is already linked to another keeper.");
    }
    if (existing && existing.vrm !== vrm) {
      throw new Error("Use Update Logbook / Plate Details to change this vehicle's registration.");
    }
    const data: Vehicle = {
      vrm, vin, make: input.make.trim(), model: input.model.trim(),
      year: input.year, odometer: input.odometer, motExpiry: input.motExpiry,
      v5cDate: "", motStatus: "Unknown",
    };
    if (existing) {
      await client.query("UPDATE vehicles SET data=$1 WHERE vin=$2", [JSON.stringify(data), vin]);
    } else {
      await client.query(`INSERT INTO vehicles(id,vin,vrm,data,status,is_sample,verification_state)
        VALUES($1,$2,$3,$4,'pending',false,'PENDING_VERIFICATION')`,
      [randomUUID(), vin, vrm, JSON.stringify(data)]);
    }
    await client.query(`INSERT INTO vehicle_registrations(vin,vrm,verification_state)
      VALUES($1,$2,'PENDING_VERIFICATION') ON CONFLICT(vin) DO NOTHING`, [vin, vrm]);
    await client.query("COMMIT");
    return { vehicle: data, status: "pending" as const, verification_state: existing?.verification_state ?? "PENDING_VERIFICATION" as const,
      message: "Vehicle saved by VIN. V5C keeper verification is still required." };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function stampServiceByVIN(input: {
  client_submission_id?: string | undefined;
  vrm: string;
  vin: string;
  physically_inspected_vin: true;
  mileage: number;
  notes: string;
  date?: string | undefined;
  category?: ServiceCategory | undefined;
  components?: string[] | undefined;
  advisories?: string[] | undefined;
  cost?: number | undefined;
  partsCost?: number | undefined;
  labourCost?: number | undefined;
  image?: string | undefined;
  invoice_name?: string | undefined;
  invoice_data?: string | undefined;
}) {
  const garage=await requireGarage();
  const vrm = normalizeVRM(input.vrm);
  const vin = normalizeVIN(input.vin);
  if (!validateVIN(vin)) throw new Error("VIN must contain 17 characters and exclude I, O and Q.");
  if (input.physically_inspected_vin !== true) throw new Error("Confirm that you physically inspected and matched the vehicle VIN.");
  const row = (await pool.query("SELECT vin,vrm,data,is_scrapped,verification_state FROM vehicles WHERE vin=$1", [vin])).rows[0];
  if (!row) throw new Error("No vehicle passport exists for that VIN.");
  if (row.verification_state !== "VERIFIED") throw new Error("Logbook or Plate Updated: Please enter your new VRM and 11-digit V5C reference number to re-verify ownership and unlock live export features.");
  if (row.vrm !== vrm) throw new Error("The registration does not match the selected VIN.");
  if (row.is_scrapped) throw new Error("This vehicle is marked as scrapped. Its passport is read-only and new service stamps are blocked.");
  if (!vinMatchesMake(vin,row.data?.make??"")) throw new Error("The VIN manufacturer prefix does not match this vehicle make.");
  const components=input.components??[];
  return createService({
    client_submission_id: input.client_submission_id,
    vrm: row.vrm,
    vin,
    physically_inspected_vin: true,
    date: input.date ?? new Date().toISOString().slice(0, 10),
    mileage: input.mileage,
    category: input.category ?? "Servicing",
    description: (input.notes.trim().slice(0,160) || components[0] || "Workshop service"),
    work_performed: input.notes.trim(),
    components,
    items: components.slice(0,30),
    advisories: input.advisories,
    cost: input.cost,
    partsCost: input.partsCost,
    labourCost: input.labourCost,
    currency: "GBP",
    garage: garage.garage_name,
    image: input.image,
    invoice_name: input.invoice_name,
    invoice_data: input.invoice_data,
    parts: [],
  });
}

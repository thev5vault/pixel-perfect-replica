import { randomUUID } from "node:crypto";
import type { Vehicle } from "@/lib/vault-store";
import { normalizeVIN, validateVIN } from "@/lib/vin";
import { currentUser, requireGarage, createService } from "./accounts";
import { pool } from "./db";
import { lookupMockRegistration } from "./dvla";

const normalizeVRM = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, "");

export async function mockVehicleLookup(vrm: string) {
  await currentUser();
  return lookupMockRegistration(vrm);
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
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const collision = (await client.query("SELECT id,vin,is_sample FROM vehicles WHERE vrm=$1 FOR UPDATE", [vrm])).rows[0];
    if (collision?.vin && collision.vin !== vin) throw new Error("That registration is already linked to a different VIN.");
    const existing = (await client.query("SELECT * FROM vehicles WHERE vin=$1 FOR UPDATE", [vin])).rows[0];
    if (existing?.is_sample) throw new Error("Development sample vehicles are read-only.");
    if (existing?.owner_user_id && existing.owner_user_id !== user.id && user.role !== "dev_admin") {
      throw new Error("This VIN is already linked to another keeper.");
    }
    const data: Vehicle = {
      vrm, vin, make: input.make.trim(), model: input.model.trim(),
      year: input.year, odometer: input.odometer, motExpiry: input.motExpiry,
      v5cDate: "", motStatus: "Unknown",
    };
    await client.query(`INSERT INTO vehicles(id,vin,vrm,data,status,is_sample)
      VALUES($1,$2,$3,$4,'pending',false)
      ON CONFLICT(vin) DO UPDATE SET vrm=EXCLUDED.vrm,data=EXCLUDED.data,
        status=CASE WHEN vehicles.owner_user_id IS NULL THEN 'pending' ELSE vehicles.status END`,
    [existing?.id ?? randomUUID(), vin, vrm, JSON.stringify(data)]);
    await client.query("COMMIT");
    return { vehicle: data, status: "pending" as const, message: "Vehicle saved by VIN. V5C keeper verification is still required." };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function stampServiceByVIN(input: {
  vrm: string;
  vin: string;
  physically_inspected_vin: boolean;
  mileage: number;
  notes: string;
}) {
  await requireGarage();
  const vrm = normalizeVRM(input.vrm);
  const vin = normalizeVIN(input.vin);
  if (!validateVIN(vin)) throw new Error("VIN must contain 17 characters and exclude I, O and Q.");
  if (input.physically_inspected_vin !== true) throw new Error("Confirm that you physically inspected and matched the vehicle VIN.");
  const row = (await pool.query("SELECT vin,vrm FROM vehicles WHERE vin=$1", [vin])).rows[0];
  if (!row) throw new Error("No vehicle passport exists for that VIN.");
  if (row.vrm !== vrm) throw new Error("The registration does not match the selected VIN.");
  return createService({
    vrm: row.vrm,
    vin,
    physically_inspected_vin: true,
    date: new Date().toISOString().slice(0, 10),
    mileage: input.mileage,
    category: "Servicing",
    description: "Workshop service",
    items: [input.notes.trim()],
    garage: "",
  });
}

import { createHash, createHmac, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type { UserAccount } from "@/lib/account-types";
import type { PendingOwnershipClaim } from "@/lib/v1-types";
import type { Vehicle } from "@/lib/vault-store";
import { vehicleLimit } from "@/lib/plans";
import { currentUser, requireAdmin, signingSecret } from "./accounts";
import { pool, inTransaction } from "./db";
import { lookupRegistration } from "./dvla";
import { paidTier } from "./billing";
const normalize = (value: string) => value.toUpperCase().replace(/\s/g, "");

export function referenceDigest(vrm: string, reference: string, secret: string) {
  return `v2.${createHmac("sha256", secret).update(JSON.stringify([vrm, reference])).digest("hex")}`;
}
async function transfer(db: PoolClient, row: { id:string;owner_user_id:string|null;is_sample:boolean;data:Vehicle }, keeper: UserAccount, hash: string, vin: string | undefined, approver: string) {
  await db.query("SELECT id FROM user_accounts WHERE id=$1 FOR UPDATE", [keeper.id]);
  const count = await db.query("SELECT count(*)::int AS count FROM vehicles WHERE owner_user_id=$1 AND id<>$2", [keeper.id, row.id]);
  if (Number(count.rows[0]?.count ?? 0) >= vehicleLimit(keeper)) throw new Error("The keeper's plan has no free vehicle slot. Free includes one vehicle; Collector includes three.");
  const used = await db.query("INSERT INTO vehicle_reference_uses(vehicle_id,reference_hash) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING vehicle_id", [row.id, hash]);
  if (!used.rowCount) throw new Error("This V5C reference has already been used.");
  if (row.owner_user_id && row.owner_user_id !== keeper.id) {
    const [services, mods] = await Promise.all([db.query("SELECT * FROM service_records WHERE vehicle_id=$1", [row.id]), db.query("SELECT * FROM modifications WHERE vehicle_id=$1", [row.id])]);
    await db.query(`INSERT INTO vehicle_transfers(id,vehicle_id,previous_keeper_id,new_keeper_id,approved_by,history_snapshot,is_sample)
      VALUES($1,$2,$3,$4,$5,$6,$7)`, [randomUUID(), row.id, row.owner_user_id, keeper.id, approver,
      JSON.stringify({ vehicle: row.data, services: services.rows, mods: mods.rows, mot_history: row.data.motHistory ?? [] }), row.is_sample]);
    await db.query("UPDATE service_records SET frozen_at=now() WHERE vehicle_id=$1 AND frozen_at IS NULL", [row.id]);
    await db.query("UPDATE modifications SET frozen_at=now() WHERE vehicle_id=$1 AND frozen_at IS NULL", [row.id]);
    await db.query("INSERT INTO account_notifications(id,user_id,message) VALUES($1,$2,$3)", [randomUUID(), row.owner_user_id, `Vehicle ${row.id} has been transferred to a new keeper. Your previous history is archived and read-only.`]);
  }
  await db.query("UPDATE vehicles SET owner_user_id=$1,v5c_reference_hash=$2,vin=COALESCE($3,vin),status='approved',keeper_changed_at=now(),public_enabled=false WHERE id=$4", [keeper.id, hash, vin || null, row.id]);
}
export async function claim(input: { vrm: string; reference: string; vin?: string | undefined }) {
  const user = await currentUser(), vrm = normalize(input.vrm);
  if (!/^\d{11}$/.test(input.reference)) throw new Error("Enter the 11-digit V5C document reference.");
  let row = (await pool.query("SELECT * FROM vehicles WHERE id=$1", [vrm])).rows[0];
  if (!row) {
    const lookup = await lookupRegistration(vrm);
    await pool.query("INSERT INTO vehicles(id,data,is_sample,status,vin) VALUES($1,$2,$3,'pending',$4) ON CONFLICT(id) DO NOTHING", [vrm, JSON.stringify(lookup.vehicle), lookup.vehicle.source === "demo", lookup.vehicle.vin ?? null]);
  }
  return inTransaction(async db => {
    row = (await db.query("SELECT * FROM vehicles WHERE id=$1 FOR UPDATE", [vrm])).rows[0];
    const sample = row.is_sample && process.env["NODE_ENV"] !== "production";
    if (row.is_sample && !sample) throw new Error("Development sample ownership is unavailable in production.");
    if (!sample && !user.email_verified) throw new Error("Verify your account email before binding a vehicle.");
    const vin = input.vin ? normalize(input.vin) : row.vin ?? row.data.vin;
    if (!sample && (!vin || !/^[A-Z0-9-]{5,24}$/.test(vin))) throw new Error("Enter the VIN/chassis number from your V5C for keeper review.");
    if (row.vin && vin && row.vin !== vin) throw new Error("The VIN does not match this vehicle's saved identity.");
    const hash = referenceDigest(vrm, input.reference, signingSecret());
    const legacyHash = createHash("sha256").update(input.reference).digest("hex");
    if (row.owner_user_id === user.id && [hash, legacyHash].includes(row.v5c_reference_hash)) return { status: "approved" as const, is_sample: Boolean(sample), message: "This vehicle is already linked to your account." };
    const used = await db.query("SELECT 1 FROM vehicle_reference_uses WHERE vehicle_id=$1 AND reference_hash=ANY($2::text[])", [vrm, [hash, legacyHash]]);
    if (used.rowCount) throw new Error("This V5C reference has already been used. A new keeper needs a new document reference.");
    const pending = await db.query("SELECT id FROM ownership_claims WHERE vehicle_id=$1 AND user_id=$2 AND reference_hash=$3 AND status='pending'", [vrm, user.id, hash]);
    if (pending.rowCount) return { status: "pending" as const, is_sample: false, message: "Your keeper claim is already waiting for document review." };
    await db.query("INSERT INTO ownership_claims(id,vehicle_id,user_id,reference_hash,vin,status,is_sample) VALUES($1,$2,$3,$4,$5,$6,$7)", [randomUUID(), vrm, user.id, hash, vin ?? null, sample ? "approved" : "pending", Boolean(sample)]);
    if (sample) await transfer(db, row, user, hash, vin, user.id);
    else await db.query("INSERT INTO account_notifications(id,user_id,message) VALUES($1,$2,$3)", [randomUUID(), user.id, `Your keeper claim for ${vrm} is pending supporting-document review. Ownership has not changed.`]);
    return { status: sample ? "approved" as const : "pending" as const, is_sample: Boolean(sample),
      message: sample ? "Development sample approved instantly. This is not official ownership verification." : "Keeper claim submitted for supporting-document review. An 11-digit format check alone cannot prove ownership." };
  });
}
export async function pendingClaims(): Promise<PendingOwnershipClaim[]> {
  await requireAdmin();
  return (await pool.query(`SELECT c.id,c.vehicle_id AS vrm,c.vin,c.created_at,c.is_sample,c.status,u.full_name AS applicant_name,u.email AS applicant_email
    FROM ownership_claims c JOIN user_accounts u ON u.id=c.user_id WHERE c.status='pending' ORDER BY c.created_at`)).rows;
}
export async function reviewClaim(input: { id: string; status: "approved" | "rejected"; reviewed_evidence: boolean; reason: string }) {
  const admin = await requireAdmin();
  if (input.status === "approved" && !input.reviewed_evidence) throw new Error("Review supporting V5C and keeper evidence before approving a live claim.");
  return inTransaction(async db => {
    const claim = (await db.query("SELECT * FROM ownership_claims WHERE id=$1 FOR UPDATE", [input.id])).rows[0];
    if (!claim || claim.status !== "pending") throw new Error("This claim is no longer pending.");
    const vehicle = (await db.query("SELECT * FROM vehicles WHERE id=$1 FOR UPDATE", [claim.vehicle_id])).rows[0];
    if (input.status === "approved") {
      if (!claim.vin && !claim.is_sample) throw new Error("A VIN/chassis number is required. Ask the keeper to resubmit their claim.");
      const target = (await db.query("SELECT * FROM user_accounts WHERE id=$1", [claim.user_id])).rows[0];
      const tier = await paidTier(target);
      await transfer(db, vehicle, { ...target, subscription_tier: tier.tier, role: target.id === admin.id ? "dev_admin" : target.role }, claim.reference_hash, claim.vin, admin.id);
    }
    await db.query("UPDATE ownership_claims SET status=$1,review_reason=$2,reviewed_by=$3,reviewed_at=now() WHERE id=$4", [input.status, input.reason, admin.id, input.id]);
    await db.query("INSERT INTO account_notifications(id,user_id,message) VALUES($1,$2,$3)", [randomUUID(), claim.user_id, `Your keeper claim for ${claim.vehicle_id} was ${input.status}. ${input.reason}`]);
    return { ok: true };
  });
}
export async function refreshVehicle(inputVrm: string) {
  const user = await currentUser(), vrm = normalize(inputVrm);
  const row = (await pool.query("SELECT * FROM vehicles WHERE id=$1", [vrm])).rows[0];
  if (!row || (row.owner_user_id !== user.id && user.role !== "dev_admin")) throw new Error("Vehicle keeper access required.");
  if (row.is_sample) throw new Error("Sample data cannot be presented as an official refresh.");
  const lookup = await lookupRegistration(vrm);
  if (lookup.vehicle.source !== "official") throw new Error("Official DVLA/DVSA access is not configured. No sample data has replaced this vehicle.");
  // Preserve the MOT readings frozen at keeper transfers.
  const frozen = (await pool.query("SELECT history_snapshot FROM vehicle_transfers WHERE vehicle_id=$1 ORDER BY transferred_at", [vrm])).rows
    .flatMap(t => t.history_snapshot.mot_history ?? []);
  const history = new Map<string, unknown>((lookup.vehicle.motHistory ?? []).map(m => [m.date, m]));
  for (const reading of frozen) history.set(reading.date, reading);
  const data = { ...row.data, ...lookup.vehicle, motHistory: [...history.values()].sort((a: any, b: any) => a.date.localeCompare(b.date)) };
  await pool.query("UPDATE vehicles SET data=$1,vin=COALESCE(vin,$2) WHERE id=$3", [JSON.stringify(data), lookup.vehicle.vin ?? null, vrm]);
  return { ok: true, message: "Official vehicle details refreshed. Frozen pre-transfer MOT readings were preserved." };
}

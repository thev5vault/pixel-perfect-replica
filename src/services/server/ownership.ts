import { createHash, createHmac, randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import type { UserAccount } from "@/lib/account-types";
import type { PendingOwnershipClaim } from "@/lib/v1-types";
import type { Vehicle } from "@/lib/vault-store";
import { vehicleLimit } from "@/lib/plans";
import { normalizeVIN, validateVIN } from "@/lib/vin";
import { LG57_VYF, LG57_VYF_VIN, normalizeRegistration, resolveClaimReference, vehicleClaimPolicy } from "@/lib/vehicle-claim-policy";
import { currentUser, requireAdmin, signingSecret } from "./accounts";
import { pool, inTransaction } from "./db";
import { lookupRegistration } from "./dvla";
import { paidTier } from "./billing";
const normalize = normalizeRegistration;

export function referenceDigest(vrm: string, reference: string, secret: string) {
  return `v2.${createHmac("sha256", secret).update(JSON.stringify([vrm, reference])).digest("hex")}`;
}
async function transfer(db: PoolClient, row: { id:string;vin:string;vrm:string;owner_user_id:string|null;is_sample:boolean;data:Vehicle }, keeper: UserAccount, hash: string, vin: string | undefined, verified: boolean) {
  if (row.owner_user_id && row.owner_user_id !== keeper.id) {
    throw new Error("Vehicle already registered to an active keeper.");
  }
  if (vin && normalizeVIN(vin) !== row.vin) throw new Error("The claim VIN does not match the vehicle's immutable identity.");
  await db.query("SELECT id FROM user_accounts WHERE id=$1 FOR UPDATE", [keeper.id]);
  const count = await db.query("SELECT count(*)::int AS count FROM vehicles WHERE owner_user_id=$1 AND id<>$2", [keeper.id, row.id]);
  if (Number(count.rows[0]?.count ?? 0) >= vehicleLimit(keeper)) throw new Error("The keeper's plan has no free vehicle slot. Free includes one vehicle; Collector includes three.");
  const used = await db.query("INSERT INTO vehicle_reference_uses(vehicle_id,reference_hash) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING vehicle_id", [row.id, hash]);
  if (!used.rowCount) throw new Error("This V5C reference has already been used.");
  const verificationState = verified && !row.is_sample ? "VERIFIED" : "PENDING_VERIFICATION";
  if (verificationState === "VERIFIED") {
    await db.query("SELECT set_config('v5vault.allow_verification_update','on',true)");
  }
  const bound = await db.query(`UPDATE vehicles SET owner_user_id=$1,v5c_reference_hash=$2,status='approved',
    verification_state=$4,keeper_changed_at=now(),public_enabled=false WHERE vin=$3 AND owner_user_id IS NULL RETURNING vin`,
  [keeper.id, hash, row.vin, verificationState]);
  if (!bound.rowCount) {
    const current = (await db.query("SELECT owner_user_id FROM vehicles WHERE vin=$1 FOR UPDATE", [row.vin])).rows[0];
    if (current?.owner_user_id !== keeper.id) throw new Error("Vehicle already registered to an active keeper.");
  }
  await db.query(`INSERT INTO vehicle_registrations(vin,vrm,v5c_reference_hash,verification_state,last_verified_at)
    VALUES($1,$2,$3,$4,CASE WHEN $4='VERIFIED' THEN now() ELSE NULL END)
    ON CONFLICT(vin) DO UPDATE SET vrm=EXCLUDED.vrm,v5c_reference_hash=EXCLUDED.v5c_reference_hash,
      verification_state=EXCLUDED.verification_state,last_verified_at=EXCLUDED.last_verified_at,updated_at=now()`,
  [row.vin,row.vrm,hash,verificationState]);
}
export async function claim(input: { vrm: string; reference?: string | undefined; vin?: string | undefined }) {
  const user = await currentUser(), vrm = normalize(input.vrm);
  const policy = vehicleClaimPolicy(vrm, process.env["NODE_ENV"]);
  const firstAccount = policy === "first_account";
  const reference = resolveClaimReference(vrm, input.reference, process.env["NODE_ENV"]);
  let row = (await pool.query("SELECT * FROM vehicles WHERE vrm=$1", [vrm])).rows[0];
  const inputVin = normalizeVIN(input.vin ?? "");
  if (!row && validateVIN(inputVin)) {
    row = (await pool.query("SELECT * FROM vehicles WHERE vin=$1", [inputVin])).rows[0];
  }
  if (!row && normalizeRegistration(vrm) === LG57_VYF) {
    row = (await pool.query("SELECT * FROM vehicles WHERE vin=$1", [LG57_VYF_VIN])).rows[0];
  }
  if (row?.is_scrapped) throw new Error("This vehicle is marked as scrapped. Its passport is read-only and cannot be claimed.");
  if (row?.owner_user_id && row.owner_user_id !== user.id) {
    throw new Error("Vehicle already registered to an active keeper.");
  }
  if (row?.owner_user_id === user.id) {
    try {
      const { vehicle } = await lookupRegistration(vrm);
      const savedVin = normalizeVIN(row.vin || row.data?.vin || "");
      const liveVin = normalizeVIN(vehicle.vin || "");
      if ((!savedVin || !liveVin || savedVin === liveVin) &&
          (vehicle.source === "official" || vehicle.motHistorySource === "official")) {
        const data = { ...row.data, ...vehicle, vrm: row.vrm, vin: savedVin || liveVin };
        await pool.query("UPDATE vehicles SET data=$1,verification_tier=COALESCE($2,verification_tier) WHERE vin=$3 AND owner_user_id=$4",
          [JSON.stringify(data), vehicle.verification_tier ?? null, row.vin, user.id]);
      }
    } catch {
      // A transient live-provider error must not unlink an already claimed vehicle.
    }
    return { status: "approved" as const, is_sample: Boolean(row.is_sample), message: "This vehicle is already linked to your account." };
  }
  if (!firstAccount && !/^\d{11}$/.test(reference)) {
    throw new Error("Enter the 11-digit V5C document reference.");
  }
  if (firstAccount && !user.email_verified) {
    throw new Error("Verify your account email before binding this vehicle.");
  }
  if (!row) {
    const lookup = await lookupRegistration(vrm);
    const vin = normalizeVIN(input.vin || lookup.vehicle.vin || "");
    if (!validateVIN(vin)) throw new Error("A 17-character VIN excluding I, O and Q is required to save this vehicle.");
    if (lookup.vehicle.vin && validateVIN(lookup.vehicle.vin) && normalizeVIN(lookup.vehicle.vin) !== vin) throw new Error("The VIN does not match the vehicle lookup.");
    row = (await pool.query("SELECT * FROM vehicles WHERE vrm=$1", [vrm])).rows[0];
    if (!row) {
      const collision=(await pool.query("SELECT id,vin,vrm,owner_user_id FROM vehicles WHERE vin=$1 OR vrm=$2",[vin,vrm])).rows[0];
      if (collision?.owner_user_id && collision.owner_user_id !== user.id) {
        throw new Error("Vehicle already registered to an active keeper.");
      }
      if (collision) throw new Error("This VIN or registration is already linked to another vehicle.");
      const data={...lookup.vehicle,vrm,vin};
      await pool.query(`INSERT INTO vehicles(id,vin,vrm,data,is_sample,status,verification_tier)
        VALUES($1,$2,$3,$4,$5,'pending',$6) ON CONFLICT(vin) DO NOTHING`,
        [randomUUID(),vin,vrm,JSON.stringify(data),lookup.vehicle.source === "demo",lookup.vehicle.verification_tier??"provisional"]);
    }
  }
  return inTransaction(async db => {
    row = (await db.query("SELECT * FROM vehicles WHERE vrm=$1 FOR UPDATE", [vrm])).rows[0];
    if(!row) throw new Error("Vehicle could not be linked. Check the registration and VIN.");
    if (row.owner_user_id && row.owner_user_id !== user.id) {
      throw new Error("Vehicle already registered to an active keeper.");
    }
    if (row.owner_user_id === user.id) {
      return { status: "approved" as const, is_sample: Boolean(row.is_sample), message: "This vehicle is already linked to your account." };
    }
    const sample = row.is_sample && process.env["NODE_ENV"] !== "production";
    if (row.is_sample && !sample) throw new Error("Development sample ownership is unavailable in production.");
    if (!sample && !user.email_verified) throw new Error("Verify your account email before binding a vehicle.");
    await db.query(`INSERT INTO vehicle_registrations(vin,vrm,v5c_reference_hash,verification_state)
      VALUES($1,$2,NULL,$3) ON CONFLICT(vin) DO NOTHING`,
    [row.vin,row.vrm,row.verification_state ?? "PENDING_VERIFICATION"]);
    const vin = input.vin ? normalizeVIN(input.vin) : row.vin;
    if (!validateVIN(vin)) throw new Error("Enter the 17-character VIN/chassis number from your V5C for keeper review.");
    if (row.vin && vin && row.vin !== vin) throw new Error("The VIN does not match this vehicle's saved identity.");
    const hash = referenceDigest(vrm, firstAccount ? `development-first-claim:${user.id}` : reference, signingSecret());
    const legacyHash = createHash("sha256").update(reference).digest("hex");
    if (!firstAccount) {
      const used = await db.query("SELECT 1 FROM vehicle_reference_uses WHERE vehicle_id=$1 AND reference_hash=ANY($2::text[])", [row.id, [hash, legacyHash]]);
      if (used.rowCount) throw new Error("This V5C reference has already been used. A new keeper needs a new document reference.");
    }
    if (row.owner_user_id === user.id && [hash, legacyHash].includes(row.v5c_reference_hash)) {
      return { status: "approved" as const, is_sample: Boolean(sample), message: "This vehicle is already linked to your account." };
    }
    const pending = await db.query("SELECT id FROM ownership_claims WHERE vehicle_id=$1 AND user_id=$2 AND reference_hash=$3 AND status='pending'", [row.id, user.id, hash]);
    if (pending.rowCount) return { status: "pending" as const, is_sample: false, message: "Your keeper claim is already waiting for document review." };
    const instant = sample || firstAccount;
    await db.query("INSERT INTO ownership_claims(id,vehicle_id,user_id,reference_hash,vin,status,is_sample) VALUES($1,$2,$3,$4,$5,$6,$7)", [randomUUID(), row.id, user.id, hash, vin, instant ? "approved" : "pending", Boolean(sample)]);
    if (instant) await transfer(db, row, user, hash, vin, false);
    else await db.query("INSERT INTO account_notifications(id,user_id,message) VALUES($1,$2,$3)", [randomUUID(), user.id, `Your keeper claim for ${vrm} is pending supporting-document review. Ownership has not changed.`]);
    return { status: instant ? "approved" as const : "pending" as const, is_sample: Boolean(sample),
      message: sample
        ? "Development sample approved instantly. This is not official ownership verification."
        : firstAccount
          ? "First signed-in account bound this vehicle in development. The supplied specifications have not been verified by a live DVLA/DVSA lookup."
          : "Keeper claim submitted for supporting-document review. An 11-digit format check alone cannot prove ownership." };
  });
}
export async function pendingClaims(): Promise<PendingOwnershipClaim[]> {
  await requireAdmin();
  return (await pool.query(`SELECT c.id,v.vrm,c.vin,c.created_at,c.is_sample,c.status,u.full_name AS applicant_name,u.email AS applicant_email
    FROM ownership_claims c JOIN vehicles v ON v.id=c.vehicle_id JOIN user_accounts u ON u.id=c.user_id WHERE c.status='pending' ORDER BY c.created_at`)).rows;
}
export async function reviewClaim(input: { id: string; status: "approved" | "rejected"; reviewed_evidence: boolean; reason: string }) {
  const admin = await requireAdmin();
  if (input.status === "approved" && !input.reviewed_evidence) throw new Error("Review supporting V5C and keeper evidence before approving a live claim.");
  return inTransaction(async db => {
    const claim = (await db.query("SELECT * FROM ownership_claims WHERE id=$1 FOR UPDATE", [input.id])).rows[0];
    if (!claim || claim.status !== "pending") throw new Error("This claim is no longer pending.");
    const vehicle = (await db.query("SELECT * FROM vehicles WHERE id=$1 FOR UPDATE", [claim.vehicle_id])).rows[0];
    if (input.status === "approved") {
      if (vehicle.owner_user_id && vehicle.owner_user_id !== claim.user_id) {
        throw new Error("Vehicle already registered to an active keeper.");
      }
      if (!validateVIN(claim.vin)) throw new Error("A valid 17-character VIN is required. Ask the keeper to resubmit their claim.");
      const target = (await db.query("SELECT * FROM user_accounts WHERE id=$1", [claim.user_id])).rows[0];
      const tier = await paidTier(target);
       await transfer(db, vehicle, { ...target, subscription_tier: tier.tier, role: target.id === admin.id ? "dev_admin" : target.role }, claim.reference_hash, claim.vin, !claim.is_sample && !vehicle.is_sample);
    }
    await db.query("UPDATE ownership_claims SET status=$1,review_reason=$2,reviewed_by=$3,reviewed_at=now() WHERE id=$4", [input.status, input.reason, admin.id, input.id]);
    await db.query("INSERT INTO account_notifications(id,user_id,message) VALUES($1,$2,$3)", [randomUUID(), claim.user_id, `Your keeper claim for ${claim.vehicle_id} was ${input.status}. ${input.reason}`]);
    return { ok: true };
  });
}
export async function refreshVehicle(inputVrm: string) {
  const user = await currentUser(), vrm = normalize(inputVrm);
    const row = (await pool.query("SELECT * FROM vehicles WHERE vrm=$1", [vrm])).rows[0];
  if (!row || (row.owner_user_id !== user.id && user.role !== "dev_admin")) throw new Error("Vehicle keeper access required.");
  if (row.is_sample) throw new Error("Sample data cannot be presented as an official refresh.");
  const lookup = await lookupRegistration(vrm);
  if (lookup.vehicle.source !== "official") throw new Error("Official DVLA/DVSA access is not configured. No sample data has replaced this vehicle.");
  // Preserve the MOT readings frozen at keeper transfers.
  const frozen: Array<{ date: string }> = (await pool.query("SELECT history_snapshot FROM vehicle_transfers WHERE vehicle_id=$1 ORDER BY transferred_at", [row.id])).rows
    .flatMap(t => (t.history_snapshot.mot_history ?? []) as Array<{ date: string }>);
  const history = new Map<string, { date: string }>((lookup.vehicle.motHistory ?? []).map(m => [m.date, m]));
  for (const reading of frozen) history.set(reading.date, reading);
  if (lookup.vehicle.vin && validateVIN(lookup.vehicle.vin) && normalizeVIN(lookup.vehicle.vin) !== row.vin) throw new Error("Official lookup VIN differs from the vehicle's saved identity. Manual review is required.");
  const data = { ...row.data, ...lookup.vehicle, vrm:row.vrm, vin:row.vin, motHistory: [...history.values()].sort((a, b) => a.date.localeCompare(b.date)) };
  await pool.query(`UPDATE vehicles SET data=$1,verification_tier=CASE WHEN $2='government_data'
    THEN 'government_data' ELSE verification_tier END WHERE id=$3`, [JSON.stringify(data),lookup.vehicle.verification_tier??"provisional",row.id]);
  return { ok: true, message: "Official vehicle details refreshed. Frozen pre-transfer MOT readings were preserved." };
}

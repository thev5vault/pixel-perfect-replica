import { randomUUID } from "node:crypto";
import { normalizeVIN, validateVIN } from "@/lib/vin";
import { normalizeRegistration } from "@/lib/vehicle-claim-policy";
import { currentUser, requireAdmin, signingSecret } from "./accounts";
import { pool, inTransaction } from "./db";
import { referenceDigest } from "./ownership";
import type { VehicleVerificationState } from "@/lib/vehicle-verification";

const verificationNotice =
  "Logbook or Plate Updated: Please enter your new VRM and 11-digit V5C reference number to re-verify ownership and unlock live export features.";

function normalizeVRM(value: string) {
  return normalizeRegistration(value);
}

export async function submitVehicleReverification(input: { vin: string; vrm: string; reference: string }) {
  const user = await currentUser();
  const vin = normalizeVIN(input.vin);
  const vrm = normalizeVRM(input.vrm);
  const reference = input.reference.trim();
  if (!user.email_verified) throw new Error("Verify your email before changing vehicle registration details.");
  if (!validateVIN(vin)) throw new Error("Enter the vehicle's valid 17-character VIN.");
  if (!/^[A-Z0-9]{2,8}$/.test(vrm)) throw new Error("Enter a valid UK vehicle registration.");
  if (!/^\d{11}$/.test(reference)) throw new Error("The V5C reference must contain exactly 11 digits.");

  return inTransaction(async db => {
    const vehicle = (await db.query(`SELECT id,vin,vrm,owner_user_id,is_sample,is_scrapped,verification_state
      FROM vehicles WHERE vin=$1 FOR UPDATE`, [vin])).rows[0];
    if (!vehicle || vehicle.owner_user_id !== user.id) throw new Error("Only the current keeper can update these logbook details.");
    if (vehicle.is_sample) throw new Error("Development sample vehicles cannot be presented as live V5C verification.");
    if (vehicle.is_scrapped) throw new Error("This vehicle is read-only and cannot change registration details.");
    const pending = await db.query("SELECT id FROM vehicle_verification_requests WHERE vin=$1 AND status='pending'", [vin]);
    if (pending.rowCount) throw new Error("A logbook re-verification request is already awaiting administrator review.");

    const referenceHash = referenceDigest(vrm, reference, signingSecret());
    const current = (await db.query("SELECT vrm,v5c_reference_hash FROM vehicle_registrations WHERE vin=$1", [vin])).rows[0];
    if (current?.vrm === vrm && current.v5c_reference_hash === referenceHash) {
      throw new Error("These logbook details already match the verified vehicle record.");
    }
    const used = await db.query("SELECT 1 FROM vehicle_reference_uses WHERE vehicle_id=$1 AND reference_hash=$2", [vehicle.id, referenceHash]);
    if (used.rowCount) throw new Error("This V5C reference has already been used for this vehicle.");

    const state: VehicleVerificationState = vehicle.verification_state === "VERIFIED"
      ? "RE_VERIFICATION_REQUIRED"
      : "PENDING_VERIFICATION";
    const id = randomUUID();
    await db.query(`INSERT INTO vehicle_verification_requests(id,vin,user_id,requested_vrm,v5c_reference_hash)
      VALUES($1,$2,$3,$4,$5)`, [id, vin, user.id, vrm, referenceHash]);
    await db.query("UPDATE vehicles SET verification_state=$1,public_enabled=false WHERE vin=$2", [state, vin]);
    await db.query(`INSERT INTO vehicle_registrations(vin,vrm,v5c_reference_hash,verification_state)
      VALUES($1,$2,NULL,$3) ON CONFLICT(vin) DO UPDATE SET verification_state=EXCLUDED.verification_state,updated_at=now()`,
    [vin, vehicle.vrm, state]);
    await db.query("INSERT INTO account_notifications(id,user_id,message) VALUES($1,$2,$3)",
      [randomUUID(), user.id, "Your updated VRM and V5C details are waiting for administrator evidence review."]);
    return { id, status: "pending" as const, verification_state: state, message: verificationNotice };
  });
}

export async function pendingVehicleVerifications() {
  await requireAdmin();
  return (await pool.query(`SELECT r.id,r.vin,r.requested_vrm,r.created_at,u.id AS user_id,
      u.full_name AS applicant_name,u.email AS applicant_email,v.vrm AS current_vrm
    FROM vehicle_verification_requests r
    JOIN vehicles v ON v.vin=r.vin
    JOIN user_accounts u ON u.id=r.user_id
    WHERE r.status='pending'
    ORDER BY r.created_at`)).rows;
}

export async function reviewVehicleVerification(input: {
  id: string;
  status: "approved" | "rejected";
  reviewed_evidence: boolean;
  reason: string;
}) {
  const admin = await requireAdmin();
  if (input.status === "approved" && !input.reviewed_evidence) {
    throw new Error("Review the current V5C and confirm it matches the vehicle VIN before approving.");
  }
  return inTransaction(async db => {
    const request = (await db.query("SELECT * FROM vehicle_verification_requests WHERE id=$1 FOR UPDATE", [input.id])).rows[0];
    if (!request || request.status !== "pending") throw new Error("This re-verification request is no longer pending.");
    const vehicle = (await db.query("SELECT * FROM vehicles WHERE vin=$1 FOR UPDATE", [request.vin])).rows[0];
    if (!vehicle || vehicle.owner_user_id !== request.user_id) throw new Error("The keeper changed while this request was awaiting review.");
    if (vehicle.is_sample || vehicle.is_scrapped) throw new Error("Sample and scrapped vehicles cannot be approved for live re-verification.");

    if (input.status === "approved") {
      if (!validateVIN(request.vin)) throw new Error("The stored VIN is invalid; the request cannot be approved.");
      const collision = await db.query("SELECT vin FROM vehicles WHERE vrm=$1 AND vin<>$2 FOR UPDATE", [request.requested_vrm, request.vin]);
      if (collision.rowCount) throw new Error("That registration is already linked to another vehicle.");
      const used = await db.query("INSERT INTO vehicle_reference_uses(vehicle_id,reference_hash) VALUES($1,$2) ON CONFLICT DO NOTHING RETURNING vehicle_id",
        [vehicle.id, request.v5c_reference_hash]);
      if (!used.rowCount) throw new Error("This V5C reference has already been used for this vehicle.");
      await db.query("SELECT set_config('v5vault.allow_registration_update','on',true)");
      await db.query("SELECT set_config('v5vault.allow_verification_update','on',true)");
      await db.query(`UPDATE vehicles SET vrm=$1,
        data=COALESCE(data,'{}'::jsonb)||jsonb_build_object('vrm',$1),
        v5c_reference_hash=$2,verification_state='VERIFIED',public_enabled=false WHERE vin=$3`,
      [request.requested_vrm, request.v5c_reference_hash, request.vin]);
      await db.query(`INSERT INTO vehicle_registrations(vin,vrm,v5c_reference_hash,verification_state,last_verified_at,updated_at)
        VALUES($1,$2,$3,'VERIFIED',now(),now())
        ON CONFLICT(vin) DO UPDATE SET vrm=EXCLUDED.vrm,v5c_reference_hash=EXCLUDED.v5c_reference_hash,
          verification_state='VERIFIED',last_verified_at=now(),updated_at=now()`,
      [request.vin, request.requested_vrm, request.v5c_reference_hash]);
    } else {
      await db.query("UPDATE vehicles SET verification_state='RE_VERIFICATION_REQUIRED',public_enabled=false WHERE vin=$1", [request.vin]);
      await db.query(`UPDATE vehicle_registrations SET verification_state='RE_VERIFICATION_REQUIRED',updated_at=now() WHERE vin=$1`, [request.vin]);
    }
    await db.query(`UPDATE vehicle_verification_requests SET status=$1,review_reason=$2,reviewed_by=$3,reviewed_at=now()
      WHERE id=$4`, [input.status, input.reason, admin.id, input.id]);
    await db.query("INSERT INTO account_notifications(id,user_id,message) VALUES($1,$2,$3)",
      [randomUUID(), request.user_id, `Your logbook re-verification request was ${input.status}. ${input.reason}`]);
    return { ok: true, verification_state: input.status === "approved" ? "VERIFIED" as const : "RE_VERIFICATION_REQUIRED" as const };
  });
}

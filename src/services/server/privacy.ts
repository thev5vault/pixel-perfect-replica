import { createHash, randomUUID } from "node:crypto";
import { createClerkClient } from "@clerk/backend";
import { pool, inTransaction } from "./db";
import { currentUser, signingSecret } from "./accounts";
import { signStamp } from "./verification";
import { stripeClient } from "./stripe-client";

const clerk = createClerkClient({ secretKey: process.env["CLERK_SECRET_KEY"] ?? "" });
const PII_KEYS = new Set([
  "email", "email_address", "user_email", "display_name", "full_name",
  "first_name", "last_name", "owner_name", "keeper_name", "customer_name",
  "recipient_name", "billing_name", "address", "personal_address",
  "home_address", "address_line_1", "address_line_2", "postcode",
  "postal_code", "owner_user_id", "user_id", "created_by_user_id",
]);

function anonymizeJson(value: unknown, parent = ""): unknown {
  if (Array.isArray(value)) return value.map((item) => anonymizeJson(item, parent));
  if (!value || typeof value !== "object") return value;
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase();
    if (PII_KEYS.has(normalized) || (["name", "phone", "mobile", "telephone"].includes(normalized)
      && /customer|owner|keeper|recipient|personal|billing/i.test(parent))) continue;
    if (normalized === "invoice_name" || normalized === "invoice_filename") {
      result[key] = "invoice.pdf";
    } else if (normalized === "receipt_filename") {
      result[key] = "receipt.jpg";
    } else {
      result[key] = anonymizeJson(child, key);
    }
  }
  return result;
}

function isStripeNotFound(error: unknown) {
  return Boolean(error && typeof error === "object" && "statusCode" in error && error.statusCode === 404);
}

async function removeStripeCustomer(customerId: string | null) {
  if (!customerId) return;
  const stripe = await stripeClient();
  let cursor: string | undefined;
  for (;;) {
    const page = await stripe.subscriptions.list({ customer: customerId, status: "all", limit: 100, ...(cursor ? { starting_after: cursor } : {}) });
    for (const subscription of page.data) {
      if (!["canceled", "incomplete_expired"].includes(subscription.status)) {
        await stripe.subscriptions.cancel(subscription.id);
      }
    }
    if (!page.has_more || !page.data.length) break;
    cursor = page.data.at(-1)?.id;
  }
  const sessions = await stripe.checkout.sessions.list({ customer: customerId, status: "open", limit: 100 });
  for (const session of sessions.data) {
    if (session.metadata?.["app"] === "v5vault") await stripe.checkout.sessions.expire(session.id);
  }
  try {
    await stripe.customers.del(customerId);
  } catch (error) {
    if (!isStripeNotFound(error)) throw error;
  }
}

export async function exportAccountData(request: Request) {
  const user = await currentUser(request);
  const profile = (await pool.query(
    `SELECT email,full_name,role,subscription_tier,created_at,garage_name,garage_registration,
      workshop_type,status,subscription_status,trial_expires_at
     FROM user_accounts WHERE id=$1 AND email IS NOT NULL`, [user.id],
  )).rows[0];
  if (!profile) throw new Error("Account details could not be loaded.");
  const vehicles = (await pool.query(
    `SELECT DISTINCT v.id,v.vin,v.vrm,v.data,v.status,v.created_at,v.owner_user_id
     FROM vehicles v
     WHERE v.owner_user_id=$1
       OR EXISTS(SELECT 1 FROM ownership_claims c WHERE c.vehicle_id=v.id AND c.user_id=$1)
       OR EXISTS(SELECT 1 FROM vehicle_transfers t WHERE t.vehicle_id=v.id
          AND (t.previous_keeper_id=$1 OR t.new_keeper_id=$1))
     ORDER BY v.created_at`, [user.id],
  )).rows;
  const ids = vehicles.map((vehicle) => vehicle.id as string);
  let services: Record<string, unknown>[] = [];
  let modifications: Record<string, unknown>[] = [];
  let attachments: Record<string, unknown>[] = [];
  if (ids.length) {
    const records = (await pool.query(
      `SELECT s.* FROM service_records s
       WHERE s.vehicle_id=ANY($1::text[]) AND (
         s.created_by_user_id=$2
         OR (s.created_at >= COALESCE(
           (SELECT MAX(t.transferred_at) FROM vehicle_transfers t
             WHERE t.vehicle_id=s.vehicle_id AND t.new_keeper_id=$2
               AND t.transferred_at<=s.created_at),
           (SELECT MAX(c.created_at) FROM ownership_claims c
             WHERE c.vehicle_id=s.vehicle_id AND c.user_id=$2 AND c.status='approved'
               AND c.created_at<=s.created_at),
           (SELECT MIN(v.created_at) FROM vehicles v WHERE v.id=s.vehicle_id))
           AND NOT EXISTS(SELECT 1 FROM vehicle_transfers t
             WHERE t.vehicle_id=s.vehicle_id AND t.previous_keeper_id=$2
               AND t.transferred_at<=s.created_at))
       ORDER BY s.created_at`, [ids, user.id],
    )).rows;
    const recordIds = records.map((record) => record.id as string);
    services = records.map((record) => ({ ...record, data: anonymizeJson(record.data) }));
    modifications = (await pool.query(
      "SELECT id,vehicle_id,vin,data,created_at,frozen_at FROM modifications WHERE vehicle_id=ANY($1::text[]) ORDER BY created_at",
      [ids],
    )).rows;
    if (recordIds.length) {
      attachments = (await pool.query(
        `SELECT service_record_id,attachment_type,content_type,filename,sha256,encode(content,'base64') AS content_base64
         FROM service_attachments WHERE service_record_id=ANY($1::text[]) ORDER BY service_record_id,attachment_type`,
        [recordIds],
      )).rows;
    }
  }
  const transfers = ids.length
    ? (await pool.query(
      `SELECT id,vehicle_id,transferred_at,history_snapshot,is_sample FROM vehicle_transfers
       WHERE vehicle_id=ANY($1::text[]) AND (previous_keeper_id=$2 OR new_keeper_id=$2)
       ORDER BY transferred_at`, [ids, user.id],
    )).rows.map((row) => ({ ...row, history_snapshot: anonymizeJson(row.history_snapshot) }))
    : [];
  return {
    format: "v5vault-data-export-v1",
    exported_at: new Date().toISOString(),
    profile,
    vehicles,
    service_history: services,
    modifications,
    receipts_and_invoices: attachments,
    keeper_transfers: transfers,
  };
}

export async function deleteAccount(request: Request, confirmation: string) {
  if (confirmation !== "DELETE MY ACCOUNT") throw new Error("Type DELETE MY ACCOUNT to confirm permanent deletion.");
  const user = await currentUser(request);
  const profile = (await pool.query(
    "SELECT stripe_customer_id FROM user_accounts WHERE id=$1 AND email IS NOT NULL", [user.id],
  )).rows[0];
  if (!profile) throw new Error("Account has already been deleted.");

  // Remote identity/billing cleanup is idempotent; local VIN history is only changed below.
  await removeStripeCustomer(profile.stripe_customer_id ?? null);
  try {
    await clerk.users.deleteUser(user.id);
  } catch (error) {
    const status = error && typeof error === "object" && "status" in error ? error.status : undefined;
    if (status !== 404) throw error;
  }

  const anonymizedId = randomUUID();
  const randomReferenceHash = () => createHash("sha256").update(randomUUID()).digest("hex");
  await inTransaction(async (db) => {
    await db.query("SELECT set_config('v5vault.account_anonymization','on',true)");
    await db.query(
      `INSERT INTO user_accounts(id,email,password_hash,full_name,role,subscription_tier,
        stripe_customer_id,email_verified,webauthn_user_handle,status,is_sample)
       VALUES($1,NULL,NULL,'','civilian','free',NULL,false,NULL,'rejected',false)`, [anonymizedId],
    );
    const owned = await db.query("SELECT id FROM vehicles WHERE owner_user_id=$1 FOR UPDATE", [user.id]);
    const ownedVehicleIds = owned.rows.map((row) => row.id as string);
    if (ownedVehicleIds.length) {
      await db.query("UPDATE vehicles SET owner_user_id=NULL,v5c_reference_hash=NULL WHERE owner_user_id=$1", [user.id]);
      await db.query("UPDATE vehicle_registrations SET v5c_reference_hash=NULL WHERE vin IN (SELECT vin FROM vehicles WHERE id=ANY($1::text[]))", [ownedVehicleIds]);
    }
    const allLinked = await db.query(
      `SELECT id FROM vehicles WHERE owner_user_id=$1
       UNION SELECT vehicle_id AS id FROM ownership_claims WHERE user_id=$1
       UNION SELECT vehicle_id AS id FROM vehicle_transfers WHERE previous_keeper_id=$1 OR new_keeper_id=$1`,
      [user.id],
    );
    const linkedIds = [...new Set([...ownedVehicleIds,...allLinked.rows.map((row) => row.id as string)])];
    const records = await db.query(
      `SELECT id,data,is_sample,is_verified_stamp,stamped_by_garage_id,stamp_signature FROM service_records
       WHERE created_by_user_id=$1 OR stamped_by_garage_id=$1 OR stamped_by_user_id=$1
         OR vehicle_id=ANY($2::text[]) FOR UPDATE`, [user.id,linkedIds],
    );
    for (const row of records.rows) {
      const data = anonymizeJson(row.data);
      const garageId = row.stamped_by_garage_id === user.id ? anonymizedId : row.stamped_by_garage_id;
      const signature = row.is_verified_stamp && garageId && row.stamp_signature
        ? signStamp(row.id, garageId, data, row.is_sample, signingSecret()) : null;
      await db.query(
        `UPDATE service_records SET data=$1::jsonb,
          created_by_user_id=CASE WHEN created_by_user_id=$2 THEN $3 ELSE created_by_user_id END,
          stamped_by_garage_id=CASE WHEN stamped_by_garage_id=$2 THEN $3 ELSE stamped_by_garage_id END,
          stamped_by_user_id=CASE WHEN stamped_by_user_id=$2 THEN $3 ELSE stamped_by_user_id END,
          stamp_signature=$4
         WHERE id=$5`,
        [JSON.stringify(data), user.id, anonymizedId, signature, row.id],
      );
      await db.query(
        `UPDATE service_attachments SET filename=CASE WHEN attachment_type='invoice' THEN 'invoice.pdf' ELSE 'receipt.jpg' END
         WHERE service_record_id=$1`, [row.id],
      );
    }
    const claims = await db.query("SELECT id FROM ownership_claims WHERE user_id=$1 OR reviewed_by=$1 FOR UPDATE", [user.id]);
    for (const claim of claims.rows) {
      await db.query("UPDATE ownership_claims SET user_id=CASE WHEN user_id=$1 THEN $2 ELSE user_id END,reviewed_by=CASE WHEN reviewed_by=$1 THEN $2 ELSE reviewed_by END,reference_hash=$3,review_reason=NULL WHERE id=$4",
        [user.id,anonymizedId,randomReferenceHash(),claim.id]);
    }
    const verificationRequests = await db.query("SELECT id FROM vehicle_verification_requests WHERE user_id=$1 OR reviewed_by=$1 FOR UPDATE", [user.id]);
    for (const verification of verificationRequests.rows) {
      await db.query("UPDATE vehicle_verification_requests SET user_id=CASE WHEN user_id=$1 THEN $2 ELSE user_id END,reviewed_by=CASE WHEN reviewed_by=$1 THEN $2 ELSE reviewed_by END,v5c_reference_hash=$3,review_reason=NULL WHERE id=$4",
        [user.id,anonymizedId,randomReferenceHash(),verification.id]);
    }
    await db.query("UPDATE tier_overrides SET granted_by=$1 WHERE granted_by=$2", [anonymizedId,user.id]);
    await db.query("DELETE FROM tier_overrides WHERE user_id=$1", [user.id]);
    await db.query("DELETE FROM account_notifications WHERE user_id=$1", [user.id]);
    await db.query("DELETE FROM workshop_bookings WHERE garage_user_id=$1", [user.id]);
    await db.query("DELETE FROM reminder_preferences WHERE user_id=$1", [user.id]);
    await db.query("DELETE FROM reminder_deliveries WHERE garage_user_id=$1 OR recipient_user_id=$1", [user.id]);
    const transfers = await db.query("SELECT id,history_snapshot FROM vehicle_transfers WHERE previous_keeper_id=$1 OR new_keeper_id=$1 OR approved_by=$1 FOR UPDATE", [user.id]);
    for (const transfer of transfers.rows) {
      await db.query(
        `UPDATE vehicle_transfers SET
          previous_keeper_id=CASE WHEN previous_keeper_id=$1 THEN $2 ELSE previous_keeper_id END,
          new_keeper_id=CASE WHEN new_keeper_id=$1 THEN $2 ELSE new_keeper_id END,
          approved_by=CASE WHEN approved_by=$1 THEN $2 ELSE approved_by END,
          history_snapshot=$3::jsonb WHERE id=$4`,
        [user.id,anonymizedId,JSON.stringify(anonymizeJson(transfer.history_snapshot)),transfer.id],
      );
    }
    const orders = await db.query("SELECT id,snapshot FROM sales_pack_orders WHERE user_id=$1 FOR UPDATE", [user.id]);
    for (const order of orders.rows) {
      await db.query("UPDATE sales_pack_orders SET user_id=$1,snapshot=$2::jsonb WHERE id=$3",
        [anonymizedId,JSON.stringify(anonymizeJson(order.snapshot)),order.id]);
    }
    await db.query(
      `UPDATE user_accounts SET email=NULL,password_hash=NULL,full_name='',role='civilian',
        subscription_tier='free',stripe_customer_id=NULL,email_verified=false,
        webauthn_user_handle=NULL,garage_name='',garage_registration='',status='rejected',
        subscription_status='canceled',trial_expires_at=NULL,is_sample=false,dev_role=NULL
       WHERE id=$1`, [user.id],
    );
    await db.query("DELETE FROM user_accounts WHERE id=$1", [user.id]);
  });
  return { ok: true, passkeyCookie: `v5vault_passkey_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${new URL(request.url).protocol === "https:" ? "; Secure" : ""}` };
}

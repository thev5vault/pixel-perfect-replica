import { readFile } from "node:fs/promises";
import { passportData } from "@/lib/passport-data";
import { salesReportPdf } from "@/lib/pdf-reports";
import type { UserAccount } from "@/lib/account-types";
import type { PublicPassport } from "@/lib/v1-types";
import type { Vehicle, ServiceRecord, Modification } from "@/lib/vault-store";
import { pool } from "./db";
import { currentUser, serviceRow } from "./accounts";
import { requestOrigin } from "./billing";
import { samples } from "./dvla";
import { sampleAccount } from "@/lib/sample-account";
import { fulfillSalesPack } from "./sales-fulfillment";
import { stripeClient } from "./stripe-client";

export async function logoBytes() {
  for (const path of ["public/logo.png", ".output/public/logo.png"]) {
    try { return new Uint8Array(await readFile(path)); } catch { /* try the published asset location */ }
  }
  throw new Error("The document logo asset is unavailable.");
}
async function snapshot(vrm: string, parts: boolean): Promise<PublicPassport> {
  const row = (await pool.query("SELECT * FROM vehicles WHERE vrm=$1", [vrm])).rows[0];
  if (!row) throw new Error("Vehicle passport not found.");
  const [service, mods] = await Promise.all([pool.query("SELECT * FROM service_records WHERE vehicle_id=$1 ORDER BY created_at", [row.id]),
    pool.query("SELECT data,frozen_at FROM modifications WHERE vehicle_id=$1", [row.id])]);
  const vehicle: Vehicle = { ...row.data, vrm:row.vrm, vin: row.vin, public_enabled: row.public_enabled, is_sample: row.is_sample };
  const records: ServiceRecord[] = service.rows.map(serviceRow);
  return passportData(vehicle, records, mods.rows.map(m => ({ ...m.data, frozen_at: m.frozen_at })) as Modification[], requestOrigin(), row.is_sample, parts);
}
export async function ownerSnapshot(vrm: string, user: UserAccount) {
  const row = (await pool.query("SELECT id,owner_user_id FROM vehicles WHERE vrm=$1", [vrm])).rows[0];
  if (!row || (row.owner_user_id !== user.id && user.role !== "dev_admin")) throw new Error("Only the current keeper can export or share this passport.");
  return snapshot(vrm, true);
}
export async function publicPassport(inputVrm: string, sample = false): Promise<PublicPassport> {
  const vrm = inputVrm.toUpperCase().replace(/\s/g, "");
  if (sample) {
    if (process.env["NODE_ENV"] === "production" || !samples[vrm]) throw new Error("Sample passports are unavailable.");
    const fixture=sampleAccount();
    return { ...passportData(samples[vrm]!, fixture.services.filter(s=>s.vrm===vrm), fixture.mods.filter(m=>m.vrm===vrm), requestOrigin(), true), published: true };
  }
  const row = (await pool.query("SELECT v.*,u.subscription_tier FROM vehicles v LEFT JOIN user_accounts u ON u.id=v.owner_user_id WHERE v.vrm=$1", [vrm])).rows[0];
  if (!row || row.is_sample || row.status !== "approved") throw new Error("This vehicle has no shared public passport.");
  if (!row.public_enabled) {
    // Authenticated keeper preview is allowed; a guest receives no private data.
    const user = await currentUser();
    await ownerSnapshot(vrm,user);
    return snapshot(vrm,user.subscription_tier!=="free");
  }
  const owner = (await pool.query("SELECT * FROM user_accounts WHERE id=$1", [row.owner_user_id])).rows[0];
  const { paidTier } = await import("./billing"), entitlement = owner ? await paidTier(owner) : { tier: "free" };
  if (entitlement.tier === "free") {
    const order = (await pool.query("SELECT snapshot FROM sales_pack_orders WHERE vehicle_id=$1 AND user_id=$2 AND fulfilled_at IS NOT NULL ORDER BY created_at DESC LIMIT 1", [row.id, row.owner_user_id])).rows[0];
    if (order) return { ...order.snapshot, published: true };
  }
  return snapshot(vrm, entitlement.tier !== "free");
}
export async function publish(inputVrm: string, enabled: boolean) {
  const user = await currentUser(), vrm = inputVrm.toUpperCase().replace(/\s/g, "");
  const updated = await pool.query("UPDATE vehicles SET public_enabled=$1 WHERE vrm=$2 AND (owner_user_id=$3 OR $4) RETURNING id", [enabled, vrm, user.id, user.role === "dev_admin"]);
  if (!updated.rowCount) throw new Error("Only the current keeper can control buyer sharing.");
  return { enabled, message: enabled ? "Read-only buyer passport enabled. Keeper details and raw receipts remain private." : "Buyer passport disabled." };
}
export async function salesPdf(inputVrm: string) {
  const user = await currentUser(), vrm = inputVrm.toUpperCase().replace(/\s/g, "");
  let data: PublicPassport;
  if (user.role === "dev_admin") data = await ownerSnapshot(vrm, user);
  else {
    const pending=await pool.query(`SELECT o.stripe_checkout_session_id FROM sales_pack_orders o JOIN vehicles v ON v.id=o.vehicle_id
      WHERE v.vrm=$1 AND o.user_id=$2 AND o.fulfilled_at IS NULL AND o.stripe_checkout_session_id IS NOT NULL ORDER BY o.created_at DESC LIMIT 10`,[vrm,user.id]);
    if(pending.rows.length) {
      const stripe=await stripeClient();
      for(const row of pending.rows) await fulfillSalesPack(await stripe.checkout.sessions.retrieve(row.stripe_checkout_session_id));
    }
    const order = (await pool.query(`SELECT o.snapshot FROM sales_pack_orders o JOIN vehicles v ON v.id=o.vehicle_id
      WHERE v.vrm=$1 AND o.user_id=$2 AND o.fulfilled_at IS NOT NULL ORDER BY o.created_at DESC LIMIT 1`, [vrm, user.id])).rows[0];
    if (!order) throw new Error("Purchase the £2.99 one-off sales pack before downloading its PDF.");
    data = order.snapshot;
  }
  return salesReportPdf(data, await logoBytes());
}

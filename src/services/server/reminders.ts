import { randomUUID } from "node:crypto";
import { ReplitConnectors } from "@replit/connectors-sdk";
import type { ReminderItem, ReminderPreferences, ReminderResult } from "@/lib/v1-types";
import { currentUser, requireGarage, verifiedPhoneForUser } from "./accounts";
import { pool } from "./db";
import { requestOrigin } from "./billing";
const sdk = () => new ReplitConnectors();

async function channels() {
  let emailFrom = "", smsFrom = "", accountSid = "";
  try {
    const response = await sdk().proxy("sendgrid", "/v3/verified_senders", { method: "GET" });
    if (response.ok) {
      const data = await response.json(), senders = (data.results ?? []).filter((s: any) => s.verified);
      emailFrom = process.env["REMINDER_FROM_EMAIL"] ?? (senders.length === 1 ? senders[0].from_email : "");
      if (!senders.some((s: any) => s.from_email === emailFrom)) emailFrom = "";
    }
  } catch { /* Unconfigured providers are explicitly unavailable, never a fake send. */ }
  try {
    const accounts = await sdk().proxy("twilio", "/2010-04-01/Accounts.json", { method: "GET" });
    if (accounts.ok) {
      accountSid = (await accounts.json()).accounts?.[0]?.sid ?? "";
      if (accountSid) {
        const response = await sdk().proxy("twilio", `/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json`, { method: "GET" });
        const phones = response.ok ? (await response.json()).incoming_phone_numbers?.filter((p: any) => p.capabilities?.sms) ?? [] : [];
        smsFrom = process.env["REMINDER_FROM_PHONE"] ?? (phones.length === 1 ? phones[0].phone_number : "");
        if (!phones.some((p: any) => p.phone_number === smsFrom)) smsFrom = "";
      }
    }
  } catch { /* SMS must remain disabled until a connected sending number is available. */ }
  return { emailFrom, smsFrom, accountSid };
}
async function dueRows(garageId: string, admin: boolean) {
  const records = await pool.query(`SELECT v.id,v.data,v.owner_user_id,u.full_name,u.email,p.email AS email_allowed,p.sms AS sms_allowed,p.phone,
    s.data AS latest_service FROM vehicles v JOIN user_accounts u ON u.id=v.owner_user_id
    LEFT JOIN reminder_preferences p ON p.user_id=u.id
    JOIN LATERAL (SELECT data FROM service_records sr WHERE sr.vehicle_id=v.id AND ($2 OR sr.stamped_by_garage_id=$1)
      AND sr.created_at>=COALESCE(v.keeper_changed_at,'1970-01-01'::timestamptz) ORDER BY sr.created_at DESC LIMIT 1) s ON true
    WHERE NOT v.is_sample AND NOT u.is_sample`, [garageId, admin]);
  const today = new Date().toISOString().slice(0, 10), end = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  return records.rows.flatMap(row => ([
    { ...row, kind: "mot" as const, due_date: row.data.motExpiry },
    { ...row, kind: "service" as const, due_date: row.latest_service.next_service_due },
  ]).filter(r => typeof r.due_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.due_date) && r.due_date >= today && r.due_date <= end));
}
export async function reminders(): Promise<ReminderItem[]> {
  const user = await requireGarage(), [rows, providers, deliveries] = await Promise.all([
    dueRows(user.id, user.role === "dev_admin"), channels(),
    pool.query("SELECT vehicle_id,kind,due_date::text,created_at FROM reminder_deliveries WHERE garage_user_id=$1 AND status IN ('sending','queued')", [user.id]),
  ]);
  return rows.map(row => ({
    vrm: row.id, kind: row.kind, due_date: row.due_date, customer_label: row.full_name || "Keeper",
    email_allowed: Boolean(row.email_allowed), sms_allowed: Boolean(row.sms_allowed && row.phone),
    email_available: Boolean(providers.emailFrom), sms_available: Boolean(providers.smsFrom),
    last_sent_at: deliveries.rows.find(d => d.vehicle_id === row.id && d.kind === row.kind && d.due_date === row.due_date)?.created_at ?? null,
    is_sample: false,
  }));
}
export async function preferences(): Promise<ReminderPreferences> {
  const user = await currentUser(), row = (await pool.query("SELECT email,sms,phone FROM reminder_preferences WHERE user_id=$1", [user.id])).rows[0];
  return row ?? { email: false, sms: false, phone: "" };
}
export async function savePreferences(input: ReminderPreferences) {
  const user = await currentUser();
  if (input.email && !user.email_verified) throw new Error("Verify your email before opting in to email reminders.");
  if (input.sms && (!input.phone || input.phone !== await verifiedPhoneForUser(user.id))) throw new Error("Verify this phone number in Account Security before enabling SMS reminders.");
  await pool.query(`INSERT INTO reminder_preferences(user_id,email,sms,phone) VALUES($1,$2,$3,$4)
    ON CONFLICT(user_id) DO UPDATE SET email=EXCLUDED.email,sms=EXCLUDED.sms,phone=EXCLUDED.phone,updated_at=now()`, [user.id, input.email, input.sms, input.phone]);
  return { ok: true };
}
export async function sendReminder(input: { vrm: string; kind: "mot" | "service"; due_date: string; channel: "email" | "sms" }): Promise<ReminderResult> {
  const user = await requireGarage(), vrm = input.vrm.replace(/\s/g, "").toUpperCase();
  const row = (await dueRows(user.id, user.role === "dev_admin")).find(r => r.id === vrm && r.kind === input.kind && r.due_date === input.due_date);
  if (!row) throw new Error("This customer is not eligible for this workshop reminder.");
  const providers = await channels();
  if (input.channel === "email" && (!row.email_allowed || !providers.emailFrom)) throw new Error("Customer email consent and a verified email sender are required.");
  if (input.channel === "sms" && (!row.sms_allowed || !providers.smsFrom || row.phone !== await verifiedPhoneForUser(row.owner_user_id))) throw new Error("Customer SMS consent, a verified destination and an SMS sender are required.");
  const id = randomUUID();
  const reserved = await pool.query(`INSERT INTO reminder_deliveries(id,garage_user_id,vehicle_id,recipient_user_id,kind,due_date,channel,status)
    VALUES($1,$2,$3,$4,$5,$6,$7,'sending') ON CONFLICT(garage_user_id,vehicle_id,kind,due_date,channel)
    DO UPDATE SET status='sending',created_at=now() WHERE reminder_deliveries.status='failed' AND reminder_deliveries.created_at<now()-interval '5 minutes' RETURNING id`,
  [id, user.id, vrm, row.owner_user_id, input.kind, input.due_date, input.channel]);
  if (!reserved.rowCount) throw new Error("This reminder has already been queued. Duplicate sends are blocked.");
  const deliveryId = reserved.rows[0].id;
  const message = `${user.garage_name || "V5Vault"}: ${vrm} ${input.kind === "mot" ? "MOT" : "service"} is due on ${input.due_date}. Contact your workshop to book. Manage reminder consent: ${requestOrigin()}/settings`;
  try {
    let providerId = "";
    if (input.channel === "email") {
      const response = await sdk().proxy("sendgrid", "/v3/mail/send", { method: "POST", body: {
        personalizations: [{ to: [{ email: row.email }] }], from: { email: providers.emailFrom, name: "V5Vault maintenance reminders" },
        subject: `${vrm}: ${input.kind.toUpperCase()} due ${input.due_date}`, content: [{ type: "text/plain", value: message }],
      } });
      if (!response.ok) throw new Error("The email provider did not accept this reminder.");
      providerId = response.headers.get("x-message-id") ?? "";
    } else {
      const body = new URLSearchParams({ To: row.phone, From: providers.smsFrom, Body: message }).toString();
      const response = await sdk().proxy("twilio", `/2010-04-01/Accounts/${providers.accountSid}/Messages.json`,
        { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
      if (!response.ok) throw new Error("The SMS provider did not accept this reminder.");
      providerId = (await response.json()).sid ?? "";
    }
    await pool.query("UPDATE reminder_deliveries SET status='queued',provider_message_id=$1 WHERE id=$2", [providerId, deliveryId]);
    return { status: "queued", message: `${input.channel === "email" ? "Email" : "SMS"} accepted by the provider. Delivery is not yet confirmed.` };
  } catch {
    await pool.query("UPDATE reminder_deliveries SET status='failed' WHERE id=$1", [deliveryId]);
    throw new Error("The reminder was not queued. Check the provider connection before retrying.");
  }
}

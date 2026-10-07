import type { InvestorMetrics } from "@/lib/v1-types";
import { investorReportPdf } from "@/lib/pdf-reports";
import { requireAdmin } from "./accounts";
import { pool } from "./db";
import { initializeStripe } from "./stripe-client";
import { logoBytes } from "./passports";

export async function metrics(): Promise<InvestorMetrics> {
  await requireAdmin();
  const users = await pool.query(`SELECT count(*)::int AS total,
    count(*) FILTER(WHERE role='verified_garage' AND garage_verified AND vat_verified AND status='approved')::int AS garages,
    count(*) FILTER(WHERE garage_name<>'' AND status='pending')::int AS pending
    FROM user_accounts WHERE NOT is_sample`);
  const passports = await pool.query("SELECT count(*)::int AS total FROM vehicles WHERE owner_user_id IS NOT NULL AND status='approved' AND NOT is_sample");
  let mrr = 0, projected = 0, paying = 0;
  await initializeStripe();
  const subscriptions = await pool.query(`SELECT s.customer,s.livemode,s.status,
    p.unit_amount,COALESCE((item->>'quantity')::int,1) AS quantity,p.recurring
    FROM stripe.subscriptions s CROSS JOIN LATERAL jsonb_array_elements(s.items->'data') item
    JOIN stripe.prices p ON p.id=COALESCE(item->'price'->>'id',item->>'price')
    JOIN user_accounts u ON u.stripe_customer_id=s.customer AND NOT u.is_sample
    WHERE s.status IN ('active','trialing') AND p.currency='gbp' AND p.metadata->>'app'='v5vault'`);
  const customers = new Set<string>();
  for (const row of subscriptions.rows) {
    const months = (row.recurring?.interval === "year" ? 12 : 1) * (row.recurring?.interval_count ?? 1);
    const equivalent = Number(row.unit_amount) * Number(row.quantity) / months;
    projected += equivalent;
    if (row.livemode && row.status === "active") { mrr += equivalent; customers.add(row.customer); }
  }
  paying = customers.size;
  return { total_registered_users: users.rows[0].total, active_passports: passports.rows[0].total,
    garage_adoption: users.rows[0].garages, pending_workshops: users.rows[0].pending,
    paying_accounts: paying, mrr_pence: Math.round(mrr), projected_mrr_pence: Math.round(projected),
    as_of: new Date().toISOString(), is_sample: false };
}
export async function grantPdf() { return investorReportPdf(await metrics(), await logoBytes()); }

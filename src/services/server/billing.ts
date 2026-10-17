import { randomUUID } from "node:crypto";
import { getRequest } from "@tanstack/react-start/server";
import type { UserAccount, SubscriptionTier } from "@/lib/account-types";
import type { BillingCatalog, BillingInterval, CheckoutResult, PlanKey } from "@/lib/v1-types";
import { PLAN_DEFINITIONS, PLAN_KEYS, planForBillingInterval } from "@/lib/plans";
import { buildCheckoutCancelUrl, buildCheckoutSuccessUrl, resolveCheckoutReturnUrl } from "@/lib/checkout-return";
import { pool, inTransaction } from "./db";
import { currentUser } from "./accounts";
import { initializeStripe, stripeClient, stripeSync, stripeTestMode } from "./stripe-client";

const PRICE_ID_ENV: Record<PlanKey, string> = {
  sales_pack: "STRIPE_PRICE_CERTIFIED_PACK",
  diy_monthly: "STRIPE_PRICE_PRO_DIY_MONTHLY",
  diy_yearly: "STRIPE_PRICE_PRO_DIY_YEARLY",
  pro_monthly: "STRIPE_PRICE_PRO_MODDER_MONTHLY",
  pro_yearly: "STRIPE_PRICE_PRO_MODDER_YEARLY",
  workshop_monthly: "STRIPE_PRICE_WORKSHOP_MONTHLY",
  workshop_yearly: "STRIPE_PRICE_WORKSHOP_YEARLY",
};

export function requestOrigin() {
  const request = getRequest(), url = new URL(request.url);
  const forwarded = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const allowed = [process.env["REPLIT_DEV_DOMAIN"], ...(process.env["REPLIT_DOMAINS"]?.split(",") ?? [])].filter(Boolean);
  if (forwarded && allowed.includes(forwarded)) return `https://${forwarded}`;
  if (allowed.includes(url.host)) return `https://${url.host}`;
  // The actual request URL is the trusted runtime origin outside Replit.
  return url.origin;
}
export async function catalog(): Promise<BillingCatalog> {
  try {
    await initializeStripe();
    const testMode=await stripeTestMode();
    const stripe = await stripeClient();
    const configuredIds = new Map<PlanKey, string>();
    for (const key of PLAN_KEYS) {
      const priceId = process.env[PRICE_ID_ENV[key]]?.trim();
      if (priceId) configuredIds.set(key, priceId);
    }
    const configuredPrices = new Map<PlanKey, BillingCatalog["prices"][number]>();
    await Promise.all([...configuredIds].map(async ([key, priceId]) => {
      try {
        const price = await stripe.prices.retrieve(priceId);
        const definition = PLAN_DEFINITIONS[key];
        const rawInterval = price.recurring?.interval ?? null;
        if (rawInterval !== null && rawInterval !== "month" && rawInterval !== "year") return;
        if (!price.active || price.livemode !== !testMode || price.currency !== "gbp"
          || Number(price.unit_amount) !== definition.amount || rawInterval !== definition.interval) return;
        const interval = rawInterval as "month" | "year" | null;
        configuredPrices.set(key, {
          key, name: definition.name, amount_pence: Number(price.unit_amount), currency: "gbp",
          interval, price_id: price.id,
        });
      } catch {
        // An explicitly configured but invalid ID must not silently select a different Stripe price.
      }
    }));
    const results = await pool.query("SELECT id,lookup_key,unit_amount,currency,recurring FROM stripe.prices WHERE active=true AND livemode=$2 AND lookup_key=ANY($1::text[])", [PLAN_KEYS.map(key => `v5vault_v1_${key}`),!testMode]);
    for (const price of results.rows) {
      const key = String(price.lookup_key).replace("v5vault_v1_", "") as PlanKey;
      if (configuredIds.has(key)) continue;
      const definition = PLAN_DEFINITIONS[key];
      const interval = price.recurring?.interval ?? null;
      if (!definition || price.currency !== "gbp" || Number(price.unit_amount) !== definition.amount || interval !== definition.interval) continue;
      configuredPrices.set(key, {
        key, name: definition.name, amount_pence: Number(price.unit_amount), currency: "gbp" as const,
        interval, price_id: String(price.id),
      });
    }
    return { test_mode: testMode, preview: false, prices: PLAN_KEYS.flatMap(key => configuredPrices.has(key) ? [configuredPrices.get(key)!] : []) };
  } catch {
    return {
      test_mode: true,
      preview: true,
      prices: PLAN_KEYS.map((key) => ({
        key, name: PLAN_DEFINITIONS[key].name, amount_pence: PLAN_DEFINITIONS[key].amount,
        currency: "gbp" as const, interval: PLAN_DEFINITIONS[key].interval, price_id: `preview_${key}`,
      })),
    };
  }
}
export async function paidTier(user: UserAccount): Promise<{ tier: SubscriptionTier; unavailable: boolean }> {
  if (user.is_sample && process.env["NODE_ENV"] !== "production") return { tier: user.subscription_tier, unavailable: false };
  if (!user.stripe_customer_id) return { tier: "free", unavailable: false };
  try {
    const result = await pool.query(`SELECT p.metadata->>'tier' AS tier FROM stripe.subscriptions s
      CROSS JOIN LATERAL jsonb_array_elements(s.items->'data') item
      JOIN stripe.prices p ON p.id=COALESCE(item->'price'->>'id',item->>'price')
      WHERE s.customer=$1 AND s.status IN ('active','trialing') AND p.metadata->>'app'='v5vault'`,
    [user.stripe_customer_id]);
    const tiers = result.rows.map(r => r.tier);
    return { tier: tiers.includes("verified_garage") ? "verified_garage" : tiers.includes("pro_modder") ? "pro_modder" : tiers.includes("pro_diy") ? "pro_diy" : "free", unavailable: false };
  } catch { return { tier: "free", unavailable: true }; } // Fail closed on entitlements, without resetting an authenticated session.
}
async function customer(user: UserAccount) {
  if (user.is_sample) throw new Error("Sample accounts cannot create real billing customers.");
  if (user.stripe_customer_id) return user.stripe_customer_id;
  const stripe = await stripeClient();
  const created = await stripe.customers.create({ email: user.email, name: user.full_name, metadata: { user_id: user.id, app: "v5vault" } }, { idempotencyKey: `v5vault_customer_${user.id}` });
  await pool.query("UPDATE user_accounts SET stripe_customer_id=$1 WHERE id=$2", [created.id, user.id]);
  await (await stripeSync()).syncSingleEntity(created.id);
  return created.id;
}
function resolvePlan(plan: PlanKey, billingInterval?: BillingInterval): PlanKey {
  if (plan === "sales_pack") return plan;
  const interval = billingInterval ?? PLAN_DEFINITIONS[plan].interval;
  const resolved = planForBillingInterval(plan, interval);
  if (!(resolved in PLAN_DEFINITIONS)) throw new Error("This billing interval is not available for the selected plan.");
  return resolved;
}

export async function checkout(input: { plan: PlanKey; vrm?: string | undefined; billingInterval?: BillingInterval | undefined; returnUrl?: string | undefined }): Promise<CheckoutResult> {
  const user = await currentUser();
  if (!user.email_verified) throw new Error("Verify your account email before checkout.");
  const selectedPlan = resolvePlan(input.plan, input.billingInterval);
  if(user.tier_override==="pro_modder_lifetime" && ["pro_monthly","pro_yearly"].includes(selectedPlan)) {
    throw new Error("Your Pro Modder / Collector access is already included for life.");
  }
  return inTransaction(async db=>{
  await db.query("SELECT pg_advisory_xact_lock(hashtext($1))",[`billing:${user.id}`]);
  const prices = await catalog();
  const price = prices.prices.find(p => p.key === selectedPlan);
  if (prices.preview) return { url: null, preview: true, message: "Preview mode only. Stripe is unavailable, so no checkout, payment or subscription access was created." };
  if (!price) throw new Error("This Stripe price is not configured yet.");
  const stripe = await stripeClient(), customerId = await customer(user), origin = requestOrigin();
  const returnUrl = resolveCheckoutReturnUrl(input.returnUrl, origin);
  let orderId: string | undefined;
  if (selectedPlan === "sales_pack") {
    if (!input.vrm) throw new Error("Select the vehicle for this sales pack.");
    const vrm = input.vrm.replace(/\s/g, "").toUpperCase();
     const { salesPackSnapshot } = await import("./passports"), snapshot = await salesPackSnapshot(vrm, user);
    const vehicleId = (await pool.query("SELECT id FROM vehicles WHERE vrm=$1", [vrm])).rows[0]?.id;
    if (!vehicleId) throw new Error("Vehicle passport not found.");
    orderId = randomUUID();
    await pool.query("INSERT INTO sales_pack_orders(id,user_id,vehicle_id,snapshot) VALUES($1,$2,$3,$4)", [orderId, user.id, vehicleId, JSON.stringify(snapshot)]);
  } else {
    const existing = await pool.query("SELECT id FROM stripe.subscriptions WHERE customer=$1 AND status IN ('active','trialing','incomplete') LIMIT 1", [customerId]);
    if (existing.rowCount) throw new Error("A subscription already exists. Use Manage Billing to change or cancel it.");
    const open=(await stripe.checkout.sessions.list({customer:customerId,limit:20})).data.filter(s=>s.mode==="subscription"&&s.status==="open");
    const matching=open.find(s=>s.metadata?.["app"]==="v5vault"&&s.metadata?.["plan_key"]===selectedPlan);
    if(matching?.url)return{url:matching.url,preview:false,message:"Continue your existing checkout."};
    for(const pending of open.filter(s=>s.metadata?.["app"]==="v5vault"))await stripe.checkout.sessions.expire(pending.id);
  }
  const session = await stripe.checkout.sessions.create({
    customer: customerId, mode: selectedPlan === "sales_pack" ? "payment" : "subscription",
    ui_mode: "hosted_page",
    billing_address_collection: "auto",
    phone_number_collection: { enabled: false },
    automatic_tax: { enabled: false },
    allow_promotion_codes: true,
    ...(selectedPlan !== "sales_pack" ? { payment_method_collection: "always" as const } : {}),
    submit_type: "auto",
    integration_identifier: "hosted_web_0001",
    origin_context: "web",
    branding_settings: {
      background_color: "#ffffff",
      button_color: "#000000",
      font_family: "default",
      border_style: "rounded",
      logo: { type: "file", file: "file_1UNwXnETnffFZTutmVRk4P7A" },
    },
    line_items: [{ price: price.price_id, quantity: 1 }], client_reference_id: user.id,
    metadata: { app: "v5vault", user_id: user.id, plan_key: selectedPlan, billing_interval: PLAN_DEFINITIONS[selectedPlan].interval ?? "one_time", ...(orderId ? { order_id: orderId } : {}) },
    ...(selectedPlan !== "sales_pack" ? { subscription_data: {
      ...(selectedPlan.startsWith("workshop_") ? { trial_period_days: 30 } : {}),
      metadata: { app: "v5vault", user_id: user.id, plan_key: selectedPlan, billing_interval: PLAN_DEFINITIONS[selectedPlan].interval },
    } } : {}),
    success_url: buildCheckoutSuccessUrl(origin, returnUrl), cancel_url: buildCheckoutCancelUrl(origin, returnUrl),
  });
  if (orderId) await pool.query("UPDATE sales_pack_orders SET stripe_checkout_session_id=$1 WHERE id=$2", [session.id, orderId]);
  if (!session.url) throw new Error("Stripe did not return a checkout URL.");
  return { url: session.url, preview: false, message: prices.test_mode ? "Stripe sandbox checkout. No live payment." : "Continue to secure Stripe checkout." };
  });
}
export async function confirm(sessionId: string) {
  const user = await currentUser(), stripe = await stripeClient();
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["line_items"] });
  if (session.client_reference_id !== user.id || session.metadata?.["user_id"] !== user.id || session.metadata?.["app"] !== "v5vault") throw new Error("This checkout does not belong to your account.");
  if (session.payment_status !== "paid" || session.status !== "complete") return { fulfilled: false, message: "Payment is not complete. No access has been granted." };
  const sync = await stripeSync();
  await sync.syncSingleEntity(session.id);
  if (typeof session.subscription === "string") await sync.syncSingleEntity(session.subscription);
  const key = session.metadata?.["plan_key"] as PlanKey;
  if (!PLAN_KEYS.includes(key)) throw new Error("The purchased plan is not recognised.");
  if (key === "sales_pack") {
    const expected = await catalog(), price = expected.prices.find(p => p.key === key);
    if (!price || session.currency !== "gbp" || session.amount_total !== price.amount_pence) throw new Error("The sales pack payment amount could not be validated.");
    const updated = await pool.query("UPDATE sales_pack_orders SET fulfilled_at=COALESCE(fulfilled_at,now()) WHERE id=$1 AND user_id=$2 AND stripe_checkout_session_id=$3 RETURNING id", [session.metadata?.["order_id"], user.id, sessionId]);
    if (!updated.rowCount) throw new Error("The paid sales pack order could not be found.");
  }
  return { fulfilled: true, message: key === "sales_pack" ? "Your paid sales pack is ready to download." : "Your subscription has been confirmed by Stripe.", plan: key };
}
export async function portal(): Promise<CheckoutResult> {
  const user = await currentUser();
  if (!user.stripe_customer_id || user.is_sample) throw new Error("This account has no real billing customer.");
  const stripe=await stripeClient();
  const config=(await stripe.billingPortal.configurations.list({active:true,limit:100})).data.find(c=>c.metadata?.["app"]==="v5vault");
  if(!config)throw new Error("The billing portal is not configured for this Stripe account yet.");
  const session = await stripe.billingPortal.sessions.create({ customer: user.stripe_customer_id, configuration:config.id, return_url: `${requestOrigin()}/settings` });
  return { url: session.url, preview: false, message: "Manage your subscription in Stripe." };
}

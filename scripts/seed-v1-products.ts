import { PLAN_DEFINITIONS, PLAN_KEYS } from "../src/lib/plans";
import { stripeClient, stripeTestMode, initializeStripe } from "../src/services/server/stripe-client";

// Only seed the connected sandbox. Going live remains the user's publishing decision.
if (!await stripeTestMode()) throw new Error("Refusing to seed live Stripe products. Use the connected sandbox.");
const stripe = await stripeClient();
for (const key of PLAN_KEYS) {
  const definition = PLAN_DEFINITIONS[key];
  const found = await stripe.prices.list({ lookup_keys: [`v5vault_v1_${key}`], active: true, limit: 1 });
  if (found.data.length) continue;
  const tierKey = definition.tier ?? "sales_pack";
  const products = await stripe.products.search({ query: `metadata['app']:'v5vault' AND metadata['tier']:'${tierKey}'`, limit: 1 });
  const product = products.data[0] ?? await stripe.products.create({
    name: definition.name, description: definition.description, metadata: { app: "v5vault", tier: tierKey },
  }, { idempotencyKey: `v5vault_v1_product_${tierKey}` });
  await stripe.prices.create({ product: product.id, currency: "gbp", unit_amount: definition.amount,
    lookup_key: `v5vault_v1_${key}`, metadata: { app: "v5vault", plan_key: key, tier: tierKey },
    ...(definition.interval ? { recurring: { interval: definition.interval } } : {}),
  }, { idempotencyKey: `v5vault_v1_price_${key}` });
}
const portalConfigs=await stripe.billingPortal.configurations.list({limit:100});
if(!portalConfigs.data.some(c=>c.active&&c.metadata?.["app"]==="v5vault")) {
  const prices=(await stripe.prices.list({active:true,limit:100})).data.filter(p=>p.recurring&&p.lookup_key?.startsWith("v5vault_v1_"));
  const groups=new Map<string,string[]>();
  for(const price of prices) {
    const product=typeof price.product==="string"?price.product:price.product.id;
    groups.set(product,[...(groups.get(product)??[]),price.id]);
  }
  await stripe.billingPortal.configurations.create({
    business_profile:{headline:"Manage your V5Vault subscription"},
    metadata:{app:"v5vault"},
    features:{invoice_history:{enabled:true},payment_method_update:{enabled:true},
      subscription_cancel:{enabled:true,mode:"at_period_end"},
      subscription_update:{enabled:true,default_allowed_updates:["price"],proration_behavior:"create_prorations",
        products:[...groups].map(([product,prices])=>({product,prices}))}},
  },{idempotencyKey:"v5vault_billing_portal_v1"});
}
await initializeStripe();
console.log("V5Vault sandbox products and synced prices are ready. No live charges were activated.");
process.exit(0);

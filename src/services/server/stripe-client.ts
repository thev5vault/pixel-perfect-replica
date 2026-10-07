import Stripe from "stripe";
import { StripeSync, runMigrations } from "stripe-replit-sync";
import { ReplitConnectors } from "@replit/connectors-sdk";
import { fulfillSalesPack } from "./sales-fulfillment";

export async function stripeClient() {
  const connectors = new ReplitConnectors();
  // The connector owns credentials and refresh. This non-secret placeholder is
  // never sent upstream: Stripe SDK requests are forwarded through the proxy.
  return new Stripe("replit-connector-proxy", { httpClient: Stripe.createFetchHttpClient(async (url, options) => {
    const target = new URL(url instanceof Request ? url.url : url);
    if (target.hostname !== "api.stripe.com") throw new Error("Unexpected Stripe API host.");
    const headers = Object.fromEntries(new Headers(options?.headers));
    delete headers["authorization"];
    return connectors.proxy("stripe", `${target.pathname}${target.search}`, {
      method: (options?.method ?? "GET") as "GET" | "POST" | "DELETE" | "PATCH" | "PUT",
      headers, ...(options?.body ? { body: options.body } : {}),
    });
  }) });
}
export async function stripeTestMode() {
  const balance = await (await stripeClient()).balance.retrieve();
  return balance.livemode === false;
}
let schemaPromise: Promise<void> | undefined;
async function stripeSchema() {
  if (!schemaPromise) schemaPromise = runMigrations({ databaseUrl: process.env["DATABASE_URL"]! }).then(() => undefined)
    .catch(error => { schemaPromise = undefined; throw error; });
  await schemaPromise;
}
let syncPromise:Promise<StripeSync>|undefined;
export async function stripeSync():Promise<StripeSync> {
  if(!syncPromise) syncPromise=createSync().catch(error=>{syncPromise=undefined;throw error;});
  return syncPromise;
}
async function createSync() {
  await stripeSchema(); // The library owns this schema. Never create Stripe tables by hand.
  const client = await stripeClient();
  const response = await new ReplitConnectors().proxy("stripe", "/v1/account", { method: "GET" });
  if (!response.ok) throw new Error("The connected Stripe account could not be loaded.");
  const account = await response.json();
  const sync = new StripeSync({ poolConfig: { connectionString: process.env["DATABASE_URL"] },
    stripeSecretKey: `replit-connector:${account.id}`, stripeAccountId: account.id });
  sync.stripe = client;
  return sync;
}
let setupPromise: Promise<void> | undefined;
export function initializeStripe() {
  if (!setupPromise) setupPromise = (async () => {
    const sync = await stripeSync();
    const domain = process.env["REPLIT_DOMAINS"]?.split(",")[0] ?? process.env["REPLIT_DEV_DOMAIN"];
    if (!domain) throw new Error("The runtime public host is unavailable for Stripe webhooks.");
    await sync.findOrCreateManagedWebhook(`https://${domain}/api/stripe/webhook`);
    await sync.syncBackfill({ object: "all" });
  })().catch(error => { setupPromise = undefined; throw error; });
  return setupPromise;
}
export async function stripeWebhook(request: Request) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) return Response.json({ error: "Missing Stripe signature" }, { status: 400 });
  try {
    await initializeStripe();
    const sync = await stripeSync();
    const body=Buffer.from(await request.arrayBuffer());
    await sync.processWebhook(body, signature);
    const event=JSON.parse(body.toString("utf8")) as Stripe.Event;
    if(event.type==="checkout.session.completed"||event.type==="checkout.session.async_payment_succeeded") {
      await fulfillSalesPack(event.data.object as Stripe.Checkout.Session);
    }
    return Response.json({ received: true });
  } catch { return Response.json({ error: "Webhook could not be verified or processed." }, { status: 400 }); }
}

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { BillingInterval, CheckoutResult, PlanKey } from "@/lib/v1-types";
const vrm = z.string().trim().min(2).max(12).regex(/^[A-Za-z0-9 ]+$/);
const plan = z.enum(["sales_pack", "diy_monthly", "diy_yearly", "pro_monthly", "pro_yearly", "workshop_monthly", "workshop_yearly"]);
const billingInterval = z.enum(["month", "year"]);
export const getBillingCatalog = createServerFn({ method: "GET" }).handler(async () => (await import("./server/billing")).catalog());
export async function startCheckout({ data }: { data: { plan: PlanKey; vrm?: string | undefined; billingInterval?: BillingInterval | undefined } }): Promise<CheckoutResult> {
  const response = await fetch("/api/create-checkout-session", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await response.json() as CheckoutResult & { error?: string };
  if (!response.ok) throw new Error(result.error ?? "Checkout could not be started.");
  return result;
}
export const confirmCheckout = createServerFn({ method: "POST" }).validator(z.object({ session_id: z.string().startsWith("cs_").max(150) }))
  .handler(async ({ data }) => (await import("./server/billing")).confirm(data.session_id));
export const openBillingPortal = createServerFn({ method: "POST" }).handler(async () => (await import("./server/billing")).portal());
export const getPublicPassport = createServerFn({ method: "GET" }).validator(z.object({ vrm, sample: z.boolean().optional() }))
  .handler(async ({ data }) => (await import("./server/passports")).publicPassport(data.vrm, data.sample === true));
export const setPassportSharing = createServerFn({ method: "POST" }).validator(z.object({ vrm, enabled: z.boolean() }))
  .handler(async ({ data }) => (await import("./server/passports")).publish(data.vrm, data.enabled));
export const downloadSalesPdf = createServerFn({ method: "POST" }).validator(z.object({ vrm }))
  .handler(async ({ data }) => (await import("./server/passports")).salesPdf(data.vrm));
export const getInvestorMetrics = createServerFn({ method: "GET" }).handler(async () => (await import("./server/metrics")).metrics());
export const downloadGrantPdf = createServerFn({ method: "POST" }).handler(async () => (await import("./server/metrics")).grantPdf());
export const getCustomerReminders = createServerFn({ method: "GET" }).handler(async () => (await import("./server/reminders")).reminders());
export const sendCustomerReminder = createServerFn({ method: "POST" })
  .validator(z.object({ vrm, kind: z.enum(["mot", "service"]), due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), channel: z.enum(["email", "sms"]) }))
  .handler(async ({ data }) => (await import("./server/reminders")).sendReminder(data));
export const getReminderPreferences = createServerFn({ method: "GET" }).handler(async () => (await import("./server/reminders")).preferences());
export const saveReminderPreferences = createServerFn({ method: "POST" })
  .validator(z.object({ email: z.boolean(), sms: z.boolean(), phone: z.string().max(20).refine(v => v === "" || /^\+[1-9]\d{7,14}$/.test(v), "Use an international phone number, such as +447...") }))
  .handler(async ({ data }) => (await import("./server/reminders")).savePreferences(data));
export const getPendingOwnershipClaims = createServerFn({ method: "GET" }).handler(async () => (await import("./server/ownership")).pendingClaims());
export const reviewOwnershipClaim = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string().uuid(), status: z.enum(["approved", "rejected"]), reviewed_evidence: z.boolean(), reason: z.string().trim().min(10).max(1000) }))
  .handler(async ({ data }) => (await import("./server/ownership")).reviewClaim(data));
export const refreshOfficialVehicle = createServerFn({ method: "POST" }).validator(z.object({ vrm }))
  .handler(async ({ data }) => (await import("./server/ownership")).refreshVehicle(data.vrm));
export const submitVehicleReverification = createServerFn({ method: "POST" })
  .validator(z.object({
    vin: z.string().trim().length(17).regex(/^[A-HJ-NPR-Z0-9]{17}$/i).transform(value => value.toUpperCase()),
    vrm: vrm.transform(value => value.toUpperCase().replace(/\s/g, "")),
    reference: z.string().trim().regex(/^\d{11}$/),
  }))
  .handler(async ({ data }) => (await import("./server/vehicle-verification")).submitVehicleReverification(data));
export const getPendingVehicleVerifications = createServerFn({ method: "GET" })
  .handler(async () => (await import("./server/vehicle-verification")).pendingVehicleVerifications());
export const reviewVehicleVerification = createServerFn({ method: "POST" })
  .validator(z.object({
    id: z.string().uuid(),
    status: z.enum(["approved", "rejected"]),
    reviewed_evidence: z.boolean(),
    reason: z.string().trim().min(10).max(1000),
  }))
  .handler(async ({ data }) => (await import("./server/vehicle-verification")).reviewVehicleVerification(data));

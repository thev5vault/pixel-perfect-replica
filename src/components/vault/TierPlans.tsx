import { useEffect, useState } from "react";
import { ArrowUpRight, Check, LoaderCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useV1 } from "@/lib/use-v1";
import type { BillingCatalog, BillingInterval, PlanKey } from "@/lib/v1-types";
import { gbp, PLAN_DEFINITIONS } from "@/lib/plans";
import { useAccount } from "@/lib/account-store";

type Props = { vrm?: string; compact?: boolean; workshopOnly?: boolean };
type SubscriptionPlan = Exclude<PlanKey, "sales_pack">;

const TIERS = [
  {
    title: "Pro DIY",
    monthly: "diy_monthly",
    yearly: "diy_yearly",
    features: ["Receipt storage", "OEM parts and fluid specifications", "Itemized parts and labour costs"],
  },
  {
    title: "Pro Modder / Collector",
    monthly: "pro_monthly",
    yearly: "pro_yearly",
    features: ["Three active vehicles", "Receipt and cost history", "Modder’s Vault"],
  },
  {
    title: "Verified Workshop / Garage Pro",
    monthly: "workshop_monthly",
    yearly: "workshop_yearly",
    features: ["30-day free trial", "Unlimited workshop stamps and quick chips", "On-device local invoice OCR"],
  },
] as const satisfies readonly {
  title: string;
  monthly: SubscriptionPlan;
  yearly: SubscriptionPlan;
  features: readonly string[];
}[];

export function TierPlans({ vrm, compact = false, workshopOnly = false }: Props) {
  const v1 = useV1();
  const account = useAccount();
  const lifetimeProModder = account?.state?.user.tier_override === "pro_modder_lifetime";
  const [catalog, setCatalog] = useState<BillingCatalog | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<PlanKey | null>(null);
  const [interval, setInterval] = useState<BillingInterval>("month");

  useEffect(() => {
    let alive = true;
    void v1.getCatalog()
      .then((result) => alive && setCatalog(result))
      .catch((e: unknown) => alive && setError(message(e, "Plans could not be loaded.")));
    return () => { alive = false; };
  }, [v1]);

  async function start(key: PlanKey) {
    setBusy(key);
    setError("");
    try {
      const result = await v1.checkout(key, vrm, key === "sales_pack" ? undefined : interval);
      if (result.url) window.location.assign(result.url);
      else setError(result.message || "Checkout did not return a payment link.");
    } catch (e) {
      setError(message(e, "Checkout could not be started."));
    } finally {
      setBusy(null);
    }
  }

  return <section className="vault-card overflow-hidden">
    <div className="border-b border-border p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{workshopOnly ? "WORKSHOP SUBSCRIPTION" : "Plans & access"}</p>
      <h2 className="mt-1 text-xl font-bold">{workshopOnly ? "Verified Garage Pro Plan" : "Built for the way you keep cars."}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{workshopOnly ? "Verified Workshop / Garage Pro · £9.99 monthly or £99.99 yearly." : "Prices are shown in GBP. Workshop tools require approval and VAT verification."}</p>
      {catalog && <p className="mt-3 text-xs font-semibold text-amber-300">
        {catalog.preview ? "Preview prices only · Stripe unavailable, no checkout or charges" : v1.preview ? "Sample preview · no Stripe checkout or charges" : catalog.test_mode ? "Stripe SANDBOX · test payments only" : "Live Stripe billing"}
      </p>}
    </div>
    {error && <p role="alert" className="mx-4 mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">{error}</p>}
    {!catalog ? <div className="space-y-3 p-5" role="status"><div className="h-5 w-40 animate-pulse rounded bg-muted" /><div className="h-20 animate-pulse rounded-xl bg-muted/70" /></div> :
      <div className="space-y-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold">Billing period</p>
          <div className="inline-flex rounded-xl border border-border bg-background/50 p-1" role="group" aria-label="Billing period">
            <button type="button" aria-pressed={interval === "month"} onClick={() => setInterval("month")} className={`min-h-11 rounded-lg px-3 text-sm font-medium ${interval === "month" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>Monthly</button>
            <button type="button" aria-pressed={interval === "year"} onClick={() => setInterval("year")} className={`min-h-11 rounded-lg px-3 text-sm font-medium ${interval === "year" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}>Yearly (Save ~16%)</button>
          </div>
        </div>
        <div className={`grid auto-rows-fr min-w-0 items-stretch gap-3 ${compact ? "" : "md:grid-cols-2"}`}>
          {!workshopOnly && <article className="flex h-full flex-col rounded-xl border border-primary/35 bg-primary/5 p-4">
            <div className="flex items-start justify-between gap-2">
              <div><p className="text-xs uppercase tracking-wider text-muted-foreground">01 / Included</p><h3 className="mt-1 text-lg font-bold">Basic Driver (Free)</h3></div>
              <span className="rounded-lg bg-primary/15 p-2 text-primary"><Check className="h-5 w-5" /></span>
            </div>
            <p className="mt-2 font-display text-2xl font-bold">£0</p>
            <p className="mt-1 text-sm text-muted-foreground">One active vehicle</p>
            <ul className="mt-4 flex-1 space-y-2 text-sm"><li>Basic DIY service logging</li><li>Service and MOT timeline</li><li>Receipt photos and PDFs for proof storage</li><li>Owner-controlled public sharing</li></ul>
            <button type="button" disabled className="btn-secondary mt-4 min-h-12 w-full" aria-label={account?.state?.user.subscription_tier === "free" ? "Current Plan: Basic Driver" : "Basic Driver is included"}>
              {account?.state?.user.subscription_tier === "free" ? "Current Plan" : "Basic access included"}
            </button>
          </article>}
          {TIERS.filter((tier) => !workshopOnly || tier.monthly === "workshop_monthly").map((tier, index) => {
            const key = interval === "year" ? tier.yearly : tier.monthly;
            const price = catalog.prices.find((item) => item.key === key);
            const configured = catalog.preview || v1.preview || Boolean(price);
            const amount = price?.amount_pence ?? PLAN_DEFINITIONS[key].amount;
            const isLifetimeProModderPlan = tier.monthly === "pro_monthly" && lifetimeProModder;
            const isCurrentPlan = account?.state?.user.subscription_tier === PLAN_DEFINITIONS[key].tier;
            const unavailable = !configured && !isLifetimeProModderPlan;
            return <article key={tier.title} className="flex h-full min-w-0 flex-col rounded-xl border border-border bg-background/35 p-4">
              <div className="flex items-start justify-between gap-2">
                <div><p className="text-xs uppercase tracking-wider text-muted-foreground">{index === 0 ? "02 / Membership" : "Membership"}</p><h3 className="mt-1 font-bold">{tier.title}</h3></div>
                {tier.monthly === "workshop_monthly" ? <ShieldCheck className="h-5 w-5 shrink-0 text-primary" /> : null}
              </div>
              <p className="mt-3 font-display text-2xl font-bold">
                {isLifetimeProModderPlan ? "£0.00" : gbp(amount)}
                <span className="ml-1 text-sm font-medium text-muted-foreground">/{isLifetimeProModderPlan ? "lifetime" : interval === "year" ? "year" : "month"}</span>
              </p>
              {isLifetimeProModderPlan && <p className="mt-1 text-xs font-medium text-emerald-300">Lifetime access · no monthly charge</p>}
              <ul className="my-4 flex-1 space-y-2 text-sm text-muted-foreground">
                {tier.features.map((feature) => <li className="flex gap-2" key={feature}><Check className="h-4 w-4 shrink-0 text-primary" />{feature}</li>)}
              </ul>
              {unavailable && <p className="mb-3 text-xs text-amber-300">Stripe price not configured yet. Add the matching V5Vault lookup price before checkout is enabled.</p>}
              <button type="button" className="btn-primary mt-auto min-h-12 w-full" onClick={() => void start(key)} disabled={busy !== null || unavailable || isLifetimeProModderPlan || isCurrentPlan}>
                {busy === key ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowUpRight className="h-4 w-4" />}
                {busy === key ? "Opening checkout…" : isLifetimeProModderPlan ? "Included for life" : isCurrentPlan ? "Current Plan" : "Choose plan"}
              </button>
            </article>;
          })}
        </div>
      </div>
    }
    <div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between">
       {!workshopOnly && <div><p className="text-sm font-semibold">Certified Sales Pack · £2.99 once per report</p><p className="text-xs text-muted-foreground">A provenance PDF for the selected vehicle. Checkout is confirmed by the server.</p></div>}
      <div className="flex flex-col gap-2 sm:flex-row">
         <button type="button" className="btn-ghost min-h-11" onClick={() => toast.info("Billing Management: Portal setup will complete during live Stripe onboarding.")} disabled={busy !== null}>Billing settings</button>
         {!workshopOnly && <button type="button" className="btn-primary min-h-11" onClick={() => void start("sales_pack")} disabled={busy !== null || !vrm}>{busy === "sales_pack" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}Buy Sales Pack</button>}
      </div>
    </div>
  </section>;
}

export default TierPlans;
function message(error: unknown, fallback: string) { return error instanceof Error ? error.message : fallback; }

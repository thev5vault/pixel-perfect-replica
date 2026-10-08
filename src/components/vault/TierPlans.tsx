import { useEffect, useState } from "react";
import { ArrowUpRight, Check, LoaderCircle, ShieldCheck } from "lucide-react";
import { useV1 } from "@/lib/use-v1";
import type { BillingCatalog, PlanKey } from "@/lib/v1-types";
import { gbp } from "@/lib/plans";

type Props = { vrm?: string; compact?: boolean };
const planCopy: Record<Exclude<PlanKey, "sales_pack">, { title: string; detail: string; features: string[] }> = {
  diy_monthly: { title: "Pro DIY", detail: "£0.99 / month", features: ["Receipt storage", "OEM parts and cost breakdowns", "Legacy plan option"] },
  pro_monthly: { title: "Pro Modder / Collector", detail: "£1.49 / month", features: ["Three active vehicles", "Receipts and cost analytics", "Modder’s Vault"] },
  pro_yearly: { title: "Pro Modder / Collector", detail: "£14.99 / year", features: ["Three active vehicles", "Receipts and cost analytics", "Modder’s Vault"] },
  workshop_monthly: { title: "Garage Pro", detail: "£14.99 / month", features: ["30-day trial", "Unlimited VIN-stamped workshop jobs", "Approved workshop and VAT verification required"] },
};

export function TierPlans({ vrm, compact = false }: Props) {
  const v1 = useV1();
  const [catalog, setCatalog] = useState<BillingCatalog | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<PlanKey | "portal" | null>(null);
  useEffect(() => { let alive = true; void v1.getCatalog().then((c) => alive && setCatalog(c)).catch((e: unknown) => alive && setError(message(e, "Plans could not be loaded."))); return () => { alive = false; }; }, [v1]);
  async function start(key: PlanKey) {
    setBusy(key); setError("");
    try {
      const result = await v1.checkout(key, vrm);
      if (result.url) window.location.assign(result.url);
      else setError(result.message || "Checkout did not return a payment link.");
    } catch (e) { setError(message(e, "Checkout could not be started.")); }
    finally { setBusy(null); }
  }
  async function portal() {
    setBusy("portal"); setError("");
    try { const result = await v1.billingPortal(); if (result.url) window.location.assign(result.url); else setError(result.message || "Billing portal is unavailable."); }
    catch (e) { setError(message(e, "Billing settings could not be opened.")); }
    finally { setBusy(null); }
  }
  return <section className="vault-card overflow-hidden">
    <div className="border-b border-border p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Plans & access</p>
      <h2 className="mt-1 text-xl font-bold">Built for the way you keep cars.</h2>
      <p className="mt-1 text-sm text-muted-foreground">Prices are shown in GBP. Workshop tools require approval and VAT verification.</p>
        {catalog&&<p className="mt-3 text-xs font-semibold text-amber-300">{catalog.preview?"Preview prices only · Stripe unavailable, no checkout or charges":v1.preview?"Sample preview · no Stripe checkout or charges":catalog.test_mode?"Stripe SANDBOX · test payments only":"Live Stripe billing"}</p>}
    </div>
    {error && <p role="alert" className="mx-4 mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">{error}</p>}
    {!catalog ? <div className="space-y-3 p-5" role="status"><div className="h-5 w-40 animate-pulse rounded bg-muted"/><div className="h-20 animate-pulse rounded-xl bg-muted/70"/></div> :
    <div className={`grid gap-3 p-4 ${compact ? "" : "md:grid-cols-2"}`}>
      <div className="rounded-xl border border-primary/35 bg-primary/5 p-4">
        <div className="flex items-start justify-between"><div><p className="text-xs uppercase tracking-wider text-muted-foreground">01 / Included</p><h3 className="mt-1 text-lg font-bold">Free</h3></div><span className="rounded-lg bg-primary/15 p-2 text-primary"><Check className="h-5 w-5"/></span></div>
        <p className="mt-2 font-display text-2xl font-bold">£0</p><p className="mt-1 text-sm text-muted-foreground">One active vehicle</p>
         <ul className="mt-4 space-y-2 text-sm"><li>Basic DIY service logging</li><li>Service and MOT timeline</li><li>Owner-controlled public sharing</li></ul>
      </div>
      {(["pro_monthly", "pro_yearly", "workshop_monthly", ...(catalog.prices.some(p => p.key === "diy_monthly") ? ["diy_monthly" as const] : [])] as Exclude<PlanKey, "sales_pack">[]).map((key, index) => {
        const price = catalog.prices.find((p) => p.key === key);
        const meta = planCopy[key];
        return <article key={key} className="rounded-xl border border-border bg-background/35 p-4">
          <div className="flex items-start justify-between gap-2"><div><p className="text-xs uppercase tracking-wider text-muted-foreground">{index === 0 ? "02 / Most chosen" : "Membership"}</p><h3 className="mt-1 font-bold">{meta.title}</h3></div>{key === "workshop_monthly" ? <ShieldCheck className="h-5 w-5 text-primary"/> : null}</div>
          <p className="mt-3 font-display text-2xl font-bold">{price ? gbp(price.amount_pence) : meta.detail.split(" / ")[0]}<span className="ml-1 text-sm font-medium text-muted-foreground">/{key === "pro_yearly" ? "year" : "month"}</span></p>
          <ul className="my-4 space-y-2 text-sm text-muted-foreground">{meta.features.map((f) => <li className="flex gap-2" key={f}><Check className="h-4 w-4 shrink-0 text-primary"/>{f}</li>)}</ul>
          <button type="button" className="btn-primary min-h-12 w-full" onClick={() => void start(key)} disabled={busy !== null || (key === "workshop_monthly" && !catalog)}>{busy === key ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <ArrowUpRight className="h-4 w-4"/>}{busy === key ? "Opening checkout…" : "Choose plan"}</button>
        </article>;
      })}
    </div>}
    <div className="flex flex-col gap-3 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-sm font-semibold">Certified Sales Pack · £2.99 once per report</p><p className="text-xs text-muted-foreground">A provenance PDF for the selected vehicle. Checkout is confirmed by the server.</p></div>
      <div className="flex flex-col gap-2 sm:flex-row"><button type="button" className="btn-ghost min-h-11" onClick={() => void portal()} disabled={busy !== null}>{busy === "portal" ? <LoaderCircle className="h-4 w-4 animate-spin"/> : null}Billing settings</button><button type="button" className="btn-primary min-h-11" onClick={() => void start("sales_pack")} disabled={busy !== null || !vrm}>{busy === "sales_pack" ? <LoaderCircle className="h-4 w-4 animate-spin"/> : null}Buy Sales Pack</button></div>
    </div>
  </section>;
}
export default TierPlans;
function message(error: unknown, fallback: string) { return error instanceof Error ? error.message : fallback; }

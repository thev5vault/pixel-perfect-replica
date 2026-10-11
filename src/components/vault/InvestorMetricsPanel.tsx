import { useCallback, useEffect, useState } from "react";
import { Download, LoaderCircle, Printer, RefreshCw } from "lucide-react";
import { useV1, savePdf } from "@/lib/use-v1";
import type { InvestorMetrics } from "@/lib/v1-types";

export function InvestorMetricsPanel() {
  const v1 = useV1();
  const [metrics, setMetrics] = useState<InvestorMetrics | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { setError(""); try { setMetrics(await v1.getMetrics()); } catch (e) { setError(message(e, "Investor metrics could not be loaded.")); } }, [v1]);
  useEffect(() => { void load(); }, [load]);
  async function grant() {
    setBusy(true); setError("");
    try { savePdf(await v1.grantPdf()); }
    catch (e) { setError(message(e, "Grant report could not be downloaded.")); }
    finally { setBusy(false); }
  }
  const cards = metrics ? [
    ["Registered users", metrics.total_registered_users.toLocaleString("en-GB"), "Accounts"],
    ["Active passports", metrics.active_passports.toLocaleString("en-GB"), "Linked vehicles"],
    ["Workshop adoption", metrics.garage_adoption.toLocaleString("en-GB"), "Verified workshops"],
    ["Paying accounts", metrics.paying_accounts.toLocaleString("en-GB"), "Current subscriptions"],
    ["Monthly recurring revenue", money(metrics.mrr_pence), "Current MRR"],
    ["Projected MRR", money(metrics.projected_mrr_pence), "Indicative projection"],
  ] : [];
  return <section className="vault-card overflow-hidden">
    <header className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">V5Vault / metrics</p><h2 className="mt-1 text-xl font-bold">Investor snapshot</h2><p className="mt-1 text-sm text-muted-foreground">Registered activity and subscription revenue, in GBP.</p></div>
      <div className="flex gap-2"><button type="button" className="btn-ghost min-h-11" onClick={() => window.print()}><Printer className="h-4 w-4"/>Print</button><button type="button" className="btn-primary min-h-11" onClick={() => void grant()} disabled={busy}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <Download className="h-4 w-4"/>}Grant report</button></div>
    </header>
    {error && <div className="m-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm" role="alert"><p>{error}</p><button className="mt-2 inline-flex min-h-10 items-center gap-2 underline" type="button" onClick={() => void load()}><RefreshCw className="h-4 w-4"/>Retry</button></div>}
    {!metrics && !error && <div className="mb-4 grid grid-cols-2 gap-2.5 p-4" role="status">{[0,1,2,3,4,5].map((x) => <div key={x} className="h-24 animate-pulse rounded-xl bg-muted/60"/>)}</div>}
    {metrics && <>
      <div className="border-b border-border px-5 py-3 text-xs text-muted-foreground">{metrics.is_sample ? "Development sample metrics · not live financial data" : "Live data"} · snapshot {formatDate(metrics.as_of)}</div>
       <div className="mb-4 grid grid-cols-2 gap-2.5 p-4">{cards.map(([label, value, note]) => <article key={label} className="flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/80 p-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-xl font-bold text-white">{value}</p><p className="mt-1 text-xs text-muted-foreground">{note}</p></article>)}</div>
      <div className="px-5 py-4 text-xs leading-relaxed text-muted-foreground">Projected MRR is a server-provided estimate, not a revenue guarantee. Export includes the same sample status as this panel.</div>
    </>}
  </section>;
}
function money(pence: number) { return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pence / 100); }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }); }
function message(error: unknown, fallback: string) { return error instanceof Error ? error.message : fallback; }

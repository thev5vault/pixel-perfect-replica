import { useState } from "react";
import { CalendarPlus, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { can, fmtDate, fmtMiles, useVault, type ServiceRecord } from "@/lib/vault-store";
import { useAccount } from "@/lib/account-store";
import { Pill, VerifiedBadge } from "./ui-bits";
import { UpgradeDialog } from "./UpgradeDialog";

export function TimelineItem({ s, bookable = false }: { s: ServiceRecord; bookable?: boolean }) {
  const { role } = useVault();
  const account = useAccount();
  const pro = can.diy(role);
  const [upsell, setUpsell] = useState<"parts" | "receipt" | "cost" | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [bookingDate, setBookingDate] = useState("");
  const [bookingNotes, setBookingNotes] = useState("");
  const [bookingBusy, setBookingBusy] = useState(false);
  const hasOemSection = Boolean((s.parts?.length ?? 0) > 0 || s.fluids);
  const hasBreakdownData = s.items.length > 0
    || (s.parts?.length ?? 0) > 0
    || Boolean(s.fluids)
    || (s.partsCost ?? 0) > 0
    || (s.labourCost ?? 0) > 0;
  const garageName = s.garage.trim() && !/^(?:owner logged )?diy$/i.test(s.garage.trim()) ? s.garage.trim() : "";
  const isAdminStamp = s.is_verified_stamp === true && s.stamp_authority === "administrator";
  const isSampleWorkshopStamp = s.is_sample === true && s.is_verified_stamp === true && !isAdminStamp;
  const upsellCopy = {
    parts: "Upgrade to Pro DIY (£0.99/mo) for itemized parts and fluid specifications.",
    receipt: "Upgrade to Pro DIY (£0.99/mo) to view receipt photos.",
    cost: "Upgrade to Pro DIY (£0.99/mo) for itemized cost breakdowns.",
  };

  return (
    <li className="relative">
      <span className="absolute -left-[27px] top-4 h-3 w-3 rounded-full border-2 border-background bg-primary glow" />
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
        <div className="flex w-full min-w-0 flex-col gap-1.5">
          <p className="text-[11px] font-medium text-slate-400">{fmtDate(s.date)} • {fmtMiles(s.mileage)}</p>
          <h3 className="break-words text-sm font-bold leading-tight text-white">{s.description}</h3>
          <div className="mt-0.5 flex items-center">
            <span className="rounded-md border border-cyan-800/40 bg-cyan-950/40 px-2.5 py-0.5 text-[10px] font-semibold uppercase text-cyan-300/90">{s.category || "Servicing"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {isSampleWorkshopStamp
              ? <VerifiedBadge sample />
              : garageName
                ? <span title={garageName} className="max-w-full break-words rounded-md border border-slate-800 bg-slate-900/80 px-2.5 py-0.5 text-[10px] font-semibold text-slate-300">{garageName}</span>
                : <span className="rounded-md border border-slate-800 bg-slate-900/60 px-2.5 py-0.5 text-[10px] font-semibold text-slate-400">Owner Logged / DIY</span>}
            {s.is_verified_stamp === true && (
              isAdminStamp
                ? <Pill tone="primary">{s.is_sample ? "Sample administrator stamp" : "Administrator-signed record"} · <a className="underline" href={`/verify/${encodeURIComponent(s.id)}`} target="_blank" rel="noreferrer">Verify signature</a></Pill>
                : !s.is_sample && <VerifiedBadge sample={false} />
            )}
          </div>
          <div className="mt-0.5 flex w-full items-center justify-between border-t border-slate-800/60 pt-1.5">
            <div>
              {s.cost != null && s.cost > 0
                ? <span className="inline-flex items-center rounded-lg border border-emerald-800/40 bg-emerald-950/30 px-2.5 py-1 text-xs font-bold text-emerald-400">£{s.cost.toFixed(2)}</span>
                : <span className="text-[11px] font-medium text-slate-500">No cost logged</span>}
            </div>
            <div className="flex items-center gap-2">
              {(s.image || s.has_receipt || s.has_invoice) && (
                pro
                  ? s.image
                    ? <a href={s.image} target="_blank" rel="noopener noreferrer" aria-label={`View ${s.description} receipt`} className="inline-flex min-h-[44px] min-w-[44px] shrink-0 items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 transition-colors hover:bg-slate-800 hover:text-white">View receipt</a>
                    : <span className="inline-flex min-h-[44px] items-center text-[11px] text-slate-400">Receipt on file</span>
                  : <button type="button" onClick={() => setUpsell("receipt")} className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1 rounded-lg border border-slate-800 bg-slate-900/90 px-2.5 text-[11px] font-semibold text-cyan-400 hover:bg-slate-800/90" aria-label="Upgrade to Pro DIY to view receipt photo"><LockKeyhole className="h-3.5 w-3.5" />Unlock receipt</button>
              )}
              {hasBreakdownData && <button
                type="button"
                aria-expanded={isExpanded}
                aria-controls={isExpanded ? `service-breakdown-${s.id}` : undefined}
                onClick={() => setIsExpanded((expanded) => !expanded)}
                className="flex min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-1.5 text-[11px] font-semibold text-cyan-400 transition-colors hover:bg-slate-800/90 hover:text-cyan-300"
              >
                {isExpanded ? "Hide Details ˄" : "Details ˅"}
              </button>}
            </div>
          </div>
        </div>
        {isExpanded && hasBreakdownData && <div id={`service-breakdown-${s.id}`} className="mt-3 space-y-2.5 rounded-xl border border-slate-800/90 bg-slate-950/80 p-3.5 text-xs text-slate-300">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Itemized Work &amp; OEM Specs</p>
          {s.items.length > 0 && (
            <ul className="list-inside list-disc space-y-1 text-[11px] leading-relaxed text-slate-300">
              {s.items.map((it, i) => (
                <li key={i}>{it}</li>
              ))}
            </ul>
          )}
          {hasOemSection && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">OEM Parts &amp; Fluid Specs</p>
              <button
                type="button"
                disabled={pro}
                onClick={() => !pro && setUpsell("parts")}
                aria-label={pro ? undefined : "Unlock itemized OEM parts and fluid specifications"}
                className="mt-1 block w-full rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:cursor-default"
              >
                <ul className="space-y-1 text-xs" aria-label="Itemized parts">
                  {(s.parts ?? []).map((p, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 border-b border-slate-800/50 py-1 text-xs">
                      <span className="min-w-0 flex-1 text-muted-foreground">{p.name}</span>
                      <span className={`min-w-0 max-w-[60%] break-words text-right font-mono ${pro ? "text-primary" : "select-none text-slate-400 opacity-40 blur-sm"}`}>
                        {p.partNo || "Part number unavailable"}
                      </span>
                    </li>
                  ))}
                </ul>
                {s.fluids && (
                  <div className="flex items-center justify-between gap-3 border-b border-slate-800/50 py-1 text-xs">
                    <span className="min-w-0 flex-1 text-muted-foreground">Fluid specs</span>
                    <span className={`min-w-0 max-w-[60%] break-words text-right font-mono ${pro ? "text-muted-foreground" : "select-none text-slate-400 opacity-40 blur-sm"}`}>
                      {s.fluids}
                    </span>
                  </div>
                )}
              </button>
              {!pro && (
                <button
                  type="button"
                  onClick={() => setUpsell("parts")}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-950/40 px-3 py-2 text-xs font-medium text-cyan-400 shadow-sm transition-colors hover:bg-cyan-900/50"
                >
                  Unlock Itemized Parts &amp; Fluid Specs (£0.99/mo)
                </button>
              )}
            </div>
          )}
          {(s.partsCost != null || s.labourCost != null) && (
            pro ? <div className="mt-2.5 grid grid-cols-2 gap-2 border-t border-slate-800/80 pt-2.5 text-[11px]">
              {s.partsCost != null && <div className="rounded-lg border border-slate-800/60 bg-slate-900/60 p-2 text-center"><span className="block text-[9px] font-semibold uppercase text-slate-400">Parts Cost</span><strong className="text-xs font-bold text-emerald-400">£{s.partsCost.toFixed(2)}</strong></div>}
              {s.labourCost != null && <div className="rounded-lg border border-slate-800/60 bg-slate-900/60 p-2 text-center"><span className="block text-[9px] font-semibold uppercase text-slate-400">Labour Cost</span><strong className="text-xs font-bold text-cyan-400">£{s.labourCost.toFixed(2)}</strong></div>}
            </div> : !hasOemSection && <button type="button" onClick={() => setUpsell("cost")} className="text-xs font-semibold text-cyan-400 hover:text-cyan-300">Unlock itemized cost breakdown</button>
          )}
          {pro && s.invoice_data && <a href={s.invoice_data} download={s.invoice_name || "workshop-invoice.pdf"} className="block rounded-lg border border-slate-700 px-3 py-2 text-xs text-cyan-300">Download invoice · {s.invoice_name || "PDF"}</a>}
        </div>}
        {bookable && s.is_verified_stamp === true && s.is_sample !== true && account?.signedIn && (
          <div className="mt-3">
            {!bookingOpen ? <button type="button" onClick={() => setBookingOpen(true)} className="btn-ghost w-full text-sm"><CalendarPlus className="h-4 w-4" /> Book with {s.garage}</button> :
              <form className="space-y-2 rounded-xl border border-slate-700 p-3" onSubmit={async (e) => {
                e.preventDefault();
                if (!bookingDate) return;
                if (!account) return;
                setBookingBusy(true);
                try { await account.book(s.vrm, bookingDate, bookingNotes); toast.success("Booking request sent"); setBookingOpen(false); setBookingDate(""); setBookingNotes(""); }
                catch (err) { toast.error(err instanceof Error ? err.message : "Booking could not be sent"); }
                finally { setBookingBusy(false); }
              }}>
                <label className="block text-xs font-semibold">Preferred date<input required type="date" min={new Date().toISOString().slice(0,10)} value={bookingDate} onChange={(e) => setBookingDate(e.target.value)} className="field mt-1 appearance-none [-webkit-appearance:none]" /></label>
                <label className="block text-xs font-semibold">Notes<textarea maxLength={500} value={bookingNotes} onChange={(e) => setBookingNotes(e.target.value)} className="field mt-1" rows={2} /></label>
                <div className="flex gap-2"><button disabled={bookingBusy} className="btn-primary flex-1 py-2 text-xs">Send request</button><button type="button" onClick={() => setBookingOpen(false)} className="btn-ghost py-2 text-xs">Cancel</button></div>
              </form>}
          </div>
        )}
      </div>
      <UpgradeDialog
        open={upsell !== null}
        onOpenChange={(open) => {
          if (!open) setUpsell(null);
        }}
        {...(upsell
          ? {
              description: upsellCopy[upsell],
              perks: [upsellCopy[upsell].replace(/^Upgrade to Pro DIY \(£0\.99\/mo\) /, "")],
            }
          : {})}
      />
    </li>
  );
}

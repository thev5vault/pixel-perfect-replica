import { useState } from "react";
import { CalendarPlus, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { can, fmtDate, fmtMiles, useVault, type ServiceRecord } from "@/lib/vault-store";
import { Pill, Thumb, VerifiedBadge } from "./ui-bits";
import { UpgradeDialog } from "./UpgradeDialog";

export function TimelineItem({ s, bookable = false }: { s: ServiceRecord; bookable?: boolean }) {
  const { role } = useVault();
  const pro = can.diy(role);
  const [upsell, setUpsell] = useState<"parts" | "receipt" | "cost" | null>(null);
  const hasOemSection = Boolean((s.parts?.length ?? 0) > 0 || s.fluids);
  const upsellCopy = {
    parts: "Upgrade to Pro DIY (£0.99/mo) for itemized parts and fluid specifications.",
    receipt: "Upgrade to Pro DIY (£0.99/mo) to view receipt photos.",
    cost: "Upgrade to Pro DIY (£0.99/mo) for itemized cost breakdowns.",
  };

  return (
    <li className="relative">
      <span className="absolute -left-[27px] top-4 h-3 w-3 rounded-full border-2 border-background bg-primary glow" />
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <span>{fmtDate(s.date)}</span>·<span>{fmtMiles(s.mileage)}</span>
            </div>
            <h3 className="mt-0.5 font-bold">{s.description}</h3>
            <p className="text-sm text-muted-foreground">{s.garage}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            {!pro && (hasOemSection || s.partsCost != null || s.labourCost != null || s.cost != null) && (
              <Pill><LockKeyhole className="h-3 w-3" /> Pro DIY</Pill>
            )}
            {s.image &&
              (pro ? (
                <Thumb src={s.image} alt={`${s.description} receipt`} />
              ) : (
                <button
                  type="button"
                  onClick={() => setUpsell("receipt")}
                  className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border"
                  aria-label="Upgrade to Pro DIY to view receipt photo"
                >
                  <img src={s.image} alt="" loading="lazy" className="h-full w-full scale-110 object-cover blur-[4px]" />
                  <span className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-slate-950/45 text-[9px] font-bold text-white">
                    <LockKeyhole className="h-3.5 w-3.5" />
                    Pro DIY
                  </span>
                </button>
              ))}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {s.verified && <VerifiedBadge tier3={s.tier3} />}
          <Pill>{s.category}</Pill>
          {s.cost != null && pro && <Pill>£{s.cost.toFixed(2)}</Pill>}
          {s.cost != null && !pro && !hasOemSection && (
            <button type="button" onClick={() => setUpsell("cost")} className="rounded-full">
              <Pill><LockKeyhole className="h-3 w-3" /> Pro DIY cost breakdown</Pill>
            </button>
          )}
        </div>
        {s.items.length > 0 && (
          <ul className="mt-3 space-y-1 border-t pt-3 text-sm text-muted-foreground">
            {s.items.map((it, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-primary">•</span>
                {it}
              </li>
            ))}
          </ul>
        )}
        {hasOemSection && (
          <div className="mt-3 border-t pt-3">
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
                🔒 Unlock Itemized Parts &amp; Fluid Specs (£0.99/mo)
              </button>
            )}
            {pro && (s.partsCost != null || s.labourCost != null) && (
              <div className="mt-2 space-y-1 border-t border-slate-800 pt-2 text-xs text-muted-foreground">
                {s.partsCost != null && <p className="flex items-center justify-between gap-3 py-1"><span>Parts cost</span><span>£{s.partsCost.toFixed(2)}</span></p>}
                {s.labourCost != null && <p className="flex items-center justify-between gap-3 py-1"><span>Labour cost</span><span>£{s.labourCost.toFixed(2)}</span></p>}
              </div>
            )}
          </div>
        )}
        {bookable && s.tier3 && (
          <button
            onClick={() => toast.success(`Booking request sent to ${s.garage}`, { description: "They'll confirm a slot by message (demo)." })}
            className="btn-ghost mt-3 w-full text-sm"
          >
            <CalendarPlus className="h-4 w-4" /> Book with {s.garage}
          </button>
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

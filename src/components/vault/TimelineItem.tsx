import { useState } from "react";
import { CalendarPlus, LockKeyhole } from "lucide-react";
import { toast } from "sonner";
import { can, fmtDate, fmtMiles, useVault, type ServiceRecord } from "@/lib/vault-store";
import { Pill, Thumb, VerifiedBadge } from "./ui-bits";
import { UpgradeDialog } from "./UpgradeDialog";

export function TimelineItem({ s, bookable = false }: { s: ServiceRecord; bookable?: boolean }) {
  const { role } = useVault();
  const pro = can.diy(role);
  const [upsell, setUpsell] = useState<"parts" | "receipt" | "cost" | "fluids" | null>(null);
  const upsellCopy = {
    parts: "Upgrade to Pro DIY (£0.99/mo) for part numbers.",
    receipt: "Upgrade to Pro DIY (£0.99/mo) to view receipt photos.",
    cost: "Upgrade to Pro DIY (£0.99/mo) for itemized cost breakdowns.",
    fluids: "Upgrade to Pro DIY (£0.99/mo) for fluid specifications.",
  };

  return (
    <li className="relative">
      <span className="absolute -left-[27px] top-4 h-3 w-3 rounded-full border-2 border-background bg-primary glow" />
      <div className="vault-card p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <span>{fmtDate(s.date)}</span>·<span>{fmtMiles(s.mileage)}</span>
            </div>
            <h3 className="mt-0.5 font-bold">{s.description}</h3>
            <p className="text-sm text-muted-foreground">{s.garage}</p>
          </div>
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
        <div className="mt-2 flex flex-wrap gap-1.5">
          {s.verified && <VerifiedBadge tier3={s.tier3} />}
          <Pill>{s.category}</Pill>
          {s.cost != null && pro && <Pill>£{s.cost.toFixed(2)}</Pill>}
          {s.cost != null && !pro && (
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
        {s.parts && s.parts.length > 0 && (
          <div className="mt-3 border-t pt-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">OEM Parts</p>
            <ul className="mt-1 space-y-1 text-sm">
              {s.parts.map((p, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{p.name}</span>
                   <span className="flex flex-col items-end gap-1 text-right">
                     {pro ? (
                       <span className="font-mono text-xs text-primary">{p.partNo}</span>
                     ) : (
                       <>
                         <span aria-hidden="true" className="select-none font-mono text-xs text-primary blur-[4px]">
                           {p.partNo}
                         </span>
                         <button
                           type="button"
                           onClick={() => setUpsell("parts")}
                           className="text-[10px] font-semibold leading-tight text-primary hover:underline"
                         >
                           🔒 Upgrade to Pro DIY (£0.99/mo) for part numbers
                         </button>
                       </>
                     )}
                   </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {(s.fluids || (pro && (s.partsCost != null || s.labourCost != null))) && (
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            {s.fluids && (pro ? <p>Fluids: {s.fluids}</p> : (
              <button type="button" onClick={() => setUpsell("fluids")} className="text-left text-primary hover:underline">
                🔒 Upgrade to Pro DIY (£0.99/mo) for fluid specifications
              </button>
            ))}
            {pro && (s.partsCost != null || s.labourCost != null) && (
              <p>
                Parts £{(s.partsCost ?? 0).toFixed(2)} · Labour £{(s.labourCost ?? 0).toFixed(2)}
              </p>
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

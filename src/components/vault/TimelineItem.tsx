import { CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { fmtDate, fmtMiles, type ServiceRecord } from "@/lib/vault-store";
import { Pill, Thumb, VerifiedBadge } from "./ui-bits";

export function TimelineItem({ s, bookable = false }: { s: ServiceRecord; bookable?: boolean }) {
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
          {s.image && <Thumb src={s.image} alt={`${s.description} receipt`} />}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {s.verified && <VerifiedBadge tier3={s.tier3} />}
          <Pill>{s.category}</Pill>
          {s.cost != null && <Pill>£{s.cost.toFixed(2)}</Pill>}
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
                  <span className="text-right font-mono text-xs text-primary">{p.partNo}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {(s.fluids || s.partsCost != null || s.labourCost != null) && (
          <div className="mt-2 space-y-1 text-xs text-muted-foreground">
            {s.fluids && <p>Fluids: {s.fluids}</p>}
            {(s.partsCost != null || s.labourCost != null) && (
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
    </li>
  );
}

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { MotReading } from "@/lib/vault-store";
import { fmtDate, fmtMiles } from "@/lib/vault-store";

function cleanAdvisory(value: string) {
  return value
    .replace(/\s*\(?\d+(?:\.\d+)+(?:\s*\([a-z0-9]+\))*\)?/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function MotHistory({
  readings,
  official = false,
}: {
  readings: MotReading[];
  official?: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const ordered = useMemo(
    () => [...readings].sort((a, b) => b.date.localeCompare(a.date)),
    [readings],
  );
  const visible = showAll ? ordered : ordered.slice(0, 3);

  return (
    <section className="vault-card p-4" aria-label="MOT History">
      <h2 className="flex items-center justify-between gap-3 font-bold">
        <span>MOT History</span>
        <span className="text-right text-xs font-semibold text-emerald-400">
          {official ? "DVSA verified" : "Sample history"}
        </span>
      </h2>
      {visible.length > 0 ? (
        <ul className="mt-3 divide-y divide-slate-800 text-sm">
          {visible.map((reading, index) => {
            const findings = [...(reading.advisories ?? []), ...(reading.defects ?? [])].map(cleanAdvisory).filter(Boolean);
            const pass = /^pass\b/i.test(reading.result);
            return (
              <li key={`${reading.date}-${index}`} className="py-2.5">
                <div className="flex min-w-0 items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-100">{fmtDate(reading.date)}</p>
                    <p className="text-xs text-slate-400">
                      {reading.mileage !== undefined ? fmtMiles(reading.mileage) : "Mileage unavailable"}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-bold ${pass ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-rose-500/30 bg-rose-500/10 text-rose-300"}`}>
                    {pass ? "PASS" : "FAIL"}
                  </span>
                </div>
                {findings.length > 0 && (
                  <details className="group mt-2 rounded-lg border border-slate-800 bg-slate-950/60">
                    <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 px-3 text-xs font-medium text-slate-300 [&::-webkit-details-marker]:hidden">
                      <span>Advisories &amp; Defects ({findings.length})</span>
                      <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                    </summary>
                    <ul className="space-y-1 border-t border-slate-800 px-3 py-2 text-xs text-slate-400">
                      {findings.map((finding, findingIndex) => <li key={`${finding}-${findingIndex}`} className="break-words">{finding}</li>)}
                    </ul>
                  </details>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No MOT history available.</p>
      )}
      {ordered.length > 3 && (
        <button
          type="button"
          aria-expanded={showAll}
          onClick={() => setShowAll((current) => !current)}
          className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3 text-xs font-semibold text-cyan-400 hover:bg-slate-800"
        >
          {showAll ? "Show Recent MOTs" : `View All ${ordered.length} Historic MOTs`}
          <ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform ${showAll ? "rotate-180" : ""}`} />
        </button>
      )}
    </section>
  );
}

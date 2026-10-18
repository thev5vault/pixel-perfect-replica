import { useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { MotReading } from "@/lib/vault-store";
import { fmtDate, fmtMiles } from "@/lib/vault-store";
import { formatMotAdvisories } from "@/utils/motSanitizer";
import { sortMotTests } from "@/utils/motSorter";

export function MotHistory({
  readings,
  official = false,
}: {
  readings: MotReading[];
  official?: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const cardRef = useRef<HTMLElement>(null);
  const ordered = useMemo(() => sortMotTests(readings), [readings]);
  const sameDayCounts = useMemo(() => ordered.reduce((counts, test) => {
    const date = test.date.slice(0, 10);
    counts.set(date, (counts.get(date) ?? 0) + 1);
    return counts;
  }, new Map<string, number>()), [ordered]);
  const visible = showAll ? ordered : ordered.slice(0, 3);

  return (
    <section ref={cardRef} className="vault-card p-4" aria-label="MOT History">
      <h2 className="flex items-center justify-between gap-3 font-bold">
        <span>MOT History</span>
        <span className="text-right text-xs font-semibold text-emerald-400">
          {official ? "DVSA verified" : "Sample history"}
        </span>
      </h2>
      {visible.length > 0 ? (
        <ul className="mt-3 divide-y divide-slate-800 text-sm">
          {visible.map((reading, index) => {
            const findings = [...(reading.advisories ?? []), ...(reading.defects ?? [])].flatMap(formatMotAdvisories);
            const pass = /^pass\b/i.test(reading.result);
            const sameDay = (sameDayCounts.get(reading.date.slice(0, 10)) ?? 0) > 1;
            const resultLabel = sameDay ? (pass ? "RE-TEST PASS" : "INITIAL FAIL") : pass ? "PASS" : "FAIL";
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
                    {resultLabel}
                  </span>
                </div>
                {findings.length > 0 && (
                  <details className="group mt-2 rounded-lg border border-slate-800 bg-slate-950/60">
                    <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-2 px-3 text-xs font-medium text-slate-300 [&::-webkit-details-marker]:hidden">
                      <span>Advisories &amp; Defects ({findings.length})</span>
                      <ChevronDown aria-hidden="true" className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" />
                    </summary>
                    <ul className="list-disc space-y-1 border-t border-slate-800 py-2 pl-8 pr-3 text-xs text-slate-400">
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
          onClick={() => {
            const collapsing = showAll;
            setShowAll(!showAll);
            if (collapsing) requestAnimationFrame(() => {
              const card = cardRef.current;
              const main = card?.closest("main");
              if (card && main) {
                const cardTop = card.getBoundingClientRect().top;
                const mainTop = main.getBoundingClientRect().top;
                main.scrollTo({ top: main.scrollTop + cardTop - mainTop - 80, behavior: "smooth" });
              } else if (card) {
                window.scrollTo({ top: window.scrollY + card.getBoundingClientRect().top - 80, behavior: "smooth" });
              }
            });
          }}
          className="mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3 text-xs font-semibold text-cyan-400 hover:bg-slate-800"
        >
          {showAll ? "Show Recent MOTs" : `View All ${ordered.length} Historic MOTs`}
          <ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform ${showAll ? "rotate-180" : ""}`} />
        </button>
      )}
    </section>
  );
}

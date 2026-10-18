import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { MotReading } from "@/lib/vault-store";
import { fmtDate, fmtMiles } from "@/lib/vault-store";
import { formatMotAdvisories } from "@/utils/motSanitizer";
import { sortMotTests } from "@/utils/motSorter";

export function PassportMotHistory({
  readings,
  variant = "certificate",
  title = "DVSA MOT Test History",
  eyebrow,
  description,
  sourceLabel,
}: {
  readings: MotReading[];
  variant?: "certificate" | "public";
  title?: string;
  eyebrow?: string;
  description?: string;
  sourceLabel?: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const ordered = useMemo(() => sortMotTests(readings), [readings]);
  const visible = showAll ? ordered : ordered.slice(0, 3);
  const sameDayCounts = useMemo(() => ordered.reduce((counts, test) => {
    const date = test.date.slice(0, 10);
    counts.set(date, (counts.get(date) ?? 0) + 1);
    return counts;
  }, new Map<string, number>()), [ordered]);

  return (
    <section className={variant === "public" ? "vault-card min-w-0 overflow-hidden p-4 sm:p-6" : "passport-section passport-record-section min-w-0 p-4"} aria-label={title}>
      {eyebrow && <p className="text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</p>}
      <h3 className={`${eyebrow ? "mt-1" : ""} mb-2 font-bold ${variant === "public" ? "text-xl" : ""}`}>{title}</h3>
      {description && <p className="mb-3 text-xs text-muted-foreground">{description}</p>}
      {!ordered.length ? <p className="text-sm text-muted-foreground">No MOT history available.</p> : (
        <div className="passport-record-list min-w-0 space-y-2" role="list">
          {visible.map((test, index) => {
            const pass = /^pass\b/i.test(test.result);
            const sameDay = (sameDayCounts.get(test.date.slice(0, 10)) ?? 0) > 1;
            const resultLabel = sameDay ? (pass ? "RE-TEST PASS" : "INITIAL FAIL") : test.result.toUpperCase();
            const advisories = (test.advisories ?? []).flatMap(formatMotAdvisories);
            const defects = (test.defects ?? []).flatMap(formatMotAdvisories);
            return (
              <article key={`${test.date}-${index}`} className={`passport-record-card min-w-0 rounded-xl border p-3 ${variant === "public" ? "border-border bg-background/40" : "border-slate-200 bg-white/80"}`} role="listitem">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className={`font-semibold ${variant === "public" ? "" : "text-slate-900"}`}>{fmtDate(test.date)}</p>
                    <p className={`text-xs ${variant === "public" ? "text-muted-foreground" : "text-slate-600"}`}>{test.mileage !== undefined ? fmtMiles(test.mileage) : "Mileage unavailable"}</p>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-[10px] font-bold tracking-wide ${pass ? variant === "public" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300" : "border-emerald-500/30 bg-emerald-50 text-emerald-800" : variant === "public" ? "border-rose-500/30 bg-rose-500/10 text-rose-300" : "border-rose-500/30 bg-rose-50 text-rose-800"}`}>
                      {resultLabel}
                    </span>
                    {sourceLabel && <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 text-[10px] font-bold ${variant === "public" ? "border-border bg-background text-muted-foreground" : "border-slate-300 bg-slate-100 text-slate-700"}`}>{sourceLabel}</span>}
                  </div>
                </div>
                <p className={`mt-1 text-xs ${variant === "public" ? "text-muted-foreground" : "text-slate-600"}`}>{test.result}</p>
                {advisories.length > 0 && <div className="mt-2">
                  <p className={`text-[10px] font-semibold uppercase tracking-wide ${variant === "public" ? "text-muted-foreground" : "text-slate-500"}`}>Advisories</p>
                  <ul className={`mt-1 list-disc space-y-1 pl-5 text-xs ${variant === "public" ? "text-foreground" : "text-slate-700"}`}>{advisories.map((item, itemIndex) => <li key={`${item}-${itemIndex}`} className="break-words">{item}</li>)}</ul>
                </div>}
                {defects.length > 0 && <div className="mt-2">
                  <p className={`text-[10px] font-semibold uppercase tracking-wide ${variant === "public" ? "text-muted-foreground" : "text-slate-500"}`}>Defects</p>
                  <ul className={`mt-1 list-disc space-y-1 pl-5 text-xs ${variant === "public" ? "text-foreground" : "text-slate-700"}`}>{defects.map((item, itemIndex) => <li key={`${item}-${itemIndex}`} className="break-words">{item}</li>)}</ul>
                </div>}
              </article>
            );
          })}
        </div>
      )}
      {ordered.length > 3 && <button
        type="button"
        aria-expanded={showAll}
        onClick={() => setShowAll((expanded) => !expanded)}
        className={`mt-3 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold ${variant === "public" ? "border-slate-800 bg-slate-900/80 text-cyan-400 hover:bg-slate-800" : "border-slate-300 bg-slate-100 text-cyan-800 hover:bg-slate-200"}`}
      >
        {showAll ? "Show Recent MOTs" : `View All ${ordered.length} Historic MOTs`}
        <ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform ${showAll ? "rotate-180" : ""}`} />
      </button>}
    </section>
  );
}

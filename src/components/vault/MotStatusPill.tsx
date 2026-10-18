import { fmtDate } from "@/lib/vault-store";

type Props = {
  source?: "official" | "demo" | "user-provided" | undefined;
  motHistorySource?: "official" | "demo" | "user-provided" | undefined;
  motStatus?: string | undefined;
  motExpiry?: string | undefined;
  className?: string | undefined;
};

export function MotStatusPill({ source, motHistorySource, motStatus, motExpiry, className = "" }: Props) {
  if (motHistorySource !== "official" && source !== "official") return null;
  const expired = Boolean(motExpiry && new Date(`${motExpiry.slice(0, 10)}T23:59:59`).getTime() < Date.now());
  const failed = /fail/i.test(motStatus ?? "");
  const label = failed ? "MOT Failed" : expired ? "MOT Expired" : "MOT Valid";
  const tone = failed || expired
    ? "bg-rose-500/10 border-rose-500/20 text-rose-400"
    : "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
  return <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-mono ${tone} ${className}`}>
    <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 animate-pulse rounded-full ${failed || expired ? "bg-rose-400" : "bg-emerald-400"}`} />
    <span className="whitespace-nowrap text-[11px] sm:text-xs">✓ DVSA Verified · {label}{motExpiry ? ` to ${fmtDate(motExpiry)}` : ""}</span>
  </span>;
}

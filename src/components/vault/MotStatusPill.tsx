type Props = {
  source?: "official" | "demo" | "user-provided" | undefined;
  motHistorySource?: "official" | "demo" | "user-provided" | undefined;
  motStatus?: string | undefined;
  motExpiry?: string | undefined;
  className?: string | undefined;
};

export function MotStatusPill({ source, motHistorySource, motStatus, motExpiry, className = "" }: Props) {
  if (motHistorySource !== "official" && source !== "official") return null;
  void motStatus;
  void motExpiry;
  return <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 font-mono text-[11px] text-emerald-400 ${className}`}>
    ✓ DVSA Verified
  </span>;
}

import { useState, type ReactNode } from "react";
import { BadgeCheck, ImagePlus, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatVrm, readImage } from "@/lib/vault-store";

export function ShieldLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 36" className={cn("text-primary", className)} aria-hidden>
      <path d="M16 1 3 6v10c0 9 5.6 15.6 13 19 7.4-3.4 13-10 13-19V6L16 1Z" fill="currentColor" opacity="0.15" stroke="currentColor" strokeWidth="1.8" />
      <path d="M9.5 12.5 16 25l6.5-12.5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Plate({ vrm, size = "md" }: { vrm: string; size?: "sm" | "md" | "lg" }) {
  const s = { sm: "text-xs", md: "text-base", lg: "text-2xl" }[size];
  return (
    <span className={cn("uk-plate", s)}>
      <span className="flex items-center bg-primary/80 px-1 text-[0.55em] font-sans font-bold text-primary-foreground">UK</span>
      <span className="px-2 py-0.5">{formatVrm(vrm)}</span>
    </span>
  );
}

type Tone = "success" | "warning" | "primary" | "muted";
export function Pill({ tone = "muted", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  const t = {
    success: "bg-success/15 text-success border-success/30",
    warning: "bg-warning/15 text-warning border-warning/30",
    primary: "bg-primary/15 text-primary border-primary/30",
    muted: "bg-muted text-muted-foreground border-border",
  }[tone];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold", t, className)}>
      {children}
    </span>
  );
}

export function VerifiedBadge({ tier3 }: { tier3?: boolean | undefined }) {
  return (
    <Pill tone="success">
      <BadgeCheck className="h-3 w-3" />
      {tier3 ? "Tier 3: Verified Workshop" : "Verified Workshop"}
    </Pill>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function ImagePicker({ value, onChange, label = "Upload image" }: { value?: string | undefined; onChange: (v?: string) => void; label?: string }) {
  const [busy, setBusy] = useState(false);
  if (value)
    return (
      <div className="relative h-32 overflow-hidden rounded-lg border">
        <img src={value} alt="Upload preview" className="h-full w-full object-cover" />
        <button type="button" onClick={() => onChange(undefined)} className="absolute right-2 top-2 rounded-full bg-background/80 p-1" aria-label="Remove image">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  return (
    <label className="flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-input text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary">
      <ImagePlus className="h-5 w-5" />
      {busy ? "Processing…" : label}
      <input
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setBusy(true);
          try {
            onChange(await readImage(f));
          } finally {
            setBusy(false);
          }
        }}
      />
    </label>
  );
}

export function Thumb({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border transition hover:ring-2 hover:ring-primary" aria-label={`View ${alt}`}>
        <img src={src} alt={alt} loading="lazy" className="h-full w-full object-cover" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] border-none bg-background/95 p-2 sm:max-w-3xl">
          <DialogHeader className="sr-only">
            <DialogTitle>{alt}</DialogTitle>
          </DialogHeader>
          <img src={src} alt={alt} className="max-h-[85vh] w-full rounded-lg object-contain" />
        </DialogContent>
      </Dialog>
    </>
  );
}

export function PageHeader({ icon, title, subtitle }: { icon?: ReactNode; title: string; subtitle?: string }) {
  return (
    <div className="mb-5">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        {icon}
        {title}
      </h1>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

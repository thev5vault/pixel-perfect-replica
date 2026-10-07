import { useId, useState, type ReactNode } from "react";
import { BadgeCheck, ChevronDown, ImagePlus, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatVrm, readImage } from "@/lib/vault-store";

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

export function VerifiedBadge({ sample, garage, signature, recordId }: { sample?: boolean | undefined; garage?: string | undefined; signature?: string | null | undefined; recordId?: string | undefined }) {
  if (sample) return <Pill><BadgeCheck className="h-3 w-3" />Development sample · VAT not live verified{recordId && <a href={`/verify/${encodeURIComponent(recordId)}`} className="ml-1 underline underline-offset-2">Verify</a>}{signature && <span className="font-mono text-[9px]" title={`Signature: ${signature}`}>Signed</span>}</Pill>;
  return (
    <Pill tone="success">
      <BadgeCheck className="h-3 w-3" />
      Verified Workshop Stamp{garage ? ` - ${garage} (VAT Reg Verified)` : ""}
      {recordId && <a href={`/verify/${encodeURIComponent(recordId)}`} className="ml-1 underline underline-offset-2">Verify</a>}
      {signature && <span className="font-mono text-[9px]" title={`Signature: ${signature}`}>Signed</span>}
    </Pill>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block w-full min-w-0 overflow-hidden space-y-1.5 focus-within:rounded-md focus-within:ring-2 focus-within:ring-cyan-400/50 focus-within:ring-offset-2 focus-within:ring-offset-slate-900">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export const MODAL_INPUT_CLASS =
  "w-full h-11 bg-slate-900/90 border border-slate-700/70 rounded-xl px-3.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 appearance-none [-webkit-appearance:none]";

export const MODAL_SELECT_CLASS = `${MODAL_INPUT_CLASS} pr-10`;

export const MODAL_TEXTAREA_CLASS =
  "w-full min-w-0 min-h-20 bg-slate-900/90 border border-slate-700/70 rounded-xl px-3.5 py-3 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 appearance-none [-webkit-appearance:none]";

const modalFieldLabelClass = "text-[11px] font-semibold tracking-wider text-slate-400 uppercase";

export function ModalField({
  label,
  children,
  select = false,
}: {
  label: string;
  children: (controlId: string, labelId: string) => ReactNode;
  select?: boolean;
}) {
  const controlId = useId();
  const labelId = `${controlId}-label`;

  return (
    <div data-modal-field className="flex flex-col gap-1.5 w-full min-w-0">
      <label id={labelId} htmlFor={controlId} className={modalFieldLabelClass}>
        {label}
      </label>
      {select ? (
        <div className="relative w-full min-w-0">
          {children(controlId, labelId)}
          <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        </div>
      ) : (
        children(controlId, labelId)
      )}
    </div>
  );
}

export function ModalFieldGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex w-full min-w-0 flex-col gap-1.5">
      <span className={modalFieldLabelClass}>{label}</span>
      {children}
    </div>
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

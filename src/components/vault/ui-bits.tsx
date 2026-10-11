import { useId, useState, type ReactNode } from "react";
import { BadgeCheck, ChevronDown, ImagePlus, ShieldAlert, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { formatVrm, readImage } from "@/lib/vault-store";

export function Plate({ vrm, size = "md" }: { vrm: string; size?: "sm" | "md" | "lg" }) {
  const sizing = size === "sm" ? "h-8" : "mb-2 h-9 sm:h-10";
  const bandWidth = size === "sm" ? "w-4" : "w-5";
  const bandText = size === "sm" ? "text-[8px]" : "text-[8px] sm:text-[9px]";
  const textSize = size === "sm" ? "text-xs" : "text-sm sm:text-base";
  return (
    <span className={cn("uk-plate inline-flex shrink-0 items-center overflow-hidden rounded-md border border-yellow-500/60 bg-[#FFD500] text-black shadow-sm select-none", sizing)}>
      <span className={cn("flex h-full shrink-0 flex-col items-center justify-center rounded-l-[5px] border-r border-yellow-500/40 bg-[#003399] px-1 font-black leading-none text-white", bandWidth, bandText)}>UK</span>
      <span className={cn("flex h-full items-center px-2 font-mono font-black uppercase leading-none tracking-wider", textSize)}>{formatVrm(vrm)}</span>
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
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold", t, className)}>
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
  "w-full h-11 bg-slate-900/90 border border-slate-700/70 rounded-xl px-3.5 text-base text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 appearance-none [-webkit-appearance:none]";

export const MODAL_SELECT_CLASS = `${MODAL_INPUT_CLASS} pr-10`;

export const MODAL_TEXTAREA_CLASS =
  "w-full min-w-0 min-h-20 bg-slate-900/90 border border-slate-700/70 rounded-xl px-3.5 py-3 text-base text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 appearance-none [-webkit-appearance:none]";

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

export function DocumentPrivacyNotice() {
  return (
    <aside role="note" className="my-2 flex items-start gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 p-3 text-xs leading-normal text-amber-200/90">
      <ShieldAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
      <span><strong className="font-semibold text-amber-200">Privacy:</strong> Physically mask or blur your address and 11-digit V5C reference number before uploading.</span>
    </aside>
  );
}

export function ImagePicker({ value, onChange, label = "Upload image" }: { value?: string | undefined; onChange: (v?: string) => void; label?: string }) {
  const [busy, setBusy] = useState(false);
  if (value)
    return (
      <div className="relative h-32 overflow-hidden rounded-lg border">
        <img src={value} alt="Upload preview" className="h-full w-full object-cover" />
        <button type="button" onClick={() => onChange(undefined)} className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-background/80 p-0" aria-label="Remove image">
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  return (
      <label className="relative flex min-h-[76px] cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-700/80 bg-slate-900/60 p-3 text-center text-xs text-slate-300 transition-colors hover:border-cyan-500/50 hover:bg-slate-800/60 hover:text-cyan-200 focus-within:ring-2 focus-within:ring-cyan-500/50">
       <ImagePlus aria-hidden="true" className="h-5 w-5 shrink-0 text-cyan-400" />
        <span className="break-words font-medium">{busy ? "Processing…" : label}</span>
      <input
        type="file"
        accept="image/*"
        className="sr-only"
         aria-label={label}
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
      <button type="button" onClick={() => setOpen(true)} className="h-16 w-16 min-h-12 min-w-12 shrink-0 overflow-hidden rounded-lg border transition hover:ring-2 hover:ring-primary" aria-label={`View ${alt}`}>
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

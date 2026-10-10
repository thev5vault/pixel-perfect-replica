import { useRef, useState } from "react";
import { Camera, Check, LoaderCircle, LockKeyhole, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { UpgradeDialog } from "@/components/vault/UpgradeDialog";
import { readImage } from "@/lib/vault-store";
import type { ScannedServiceDocument } from "@/services/server/document-scanner";

export function isoDateFromUkDate(value: string): string | undefined {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return undefined;
  return `${match[3]}-${match[2]}-${match[1]}`;
}

export function AIScanButton({
  canScan,
  isAdmin = false,
  onScanned,
  className = "",
}: {
  canScan: boolean;
  isAdmin?: boolean;
  onScanned: (fields: ScannedServiceDocument, imageData?: string) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [detectedType, setDetectedType] = useState<ScannedServiceDocument["documentType"]>();

  async function scan(file?: File) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Choose an image no larger than 10 MB.");
      return;
    }
    setDetectedType(undefined);
    setBusy(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/service/scan-receipt", { method: "POST", body });
      const result = await response.json() as { fields?: ScannedServiceDocument; message?: string; error?: string };
      if (!response.ok || !result.fields) {
        if (result.error === "FEATURE_LOCKED") setUpgradeOpen(true);
        else toast.error(result.message ?? result.error ?? "Unable to scan. Enter the details manually.");
        return;
      }
      setDetectedType(result.fields.documentType);
      let imageData: string | undefined;
      try { imageData = await readImage(file); } catch { /* Some browsers can scan HEIC but cannot locally re-encode it. */ }
      onScanned(result.fields, imageData);
      toast.success(imageData
        ? "Form auto-filled and document attached. Verify details before saving."
        : "Form auto-filled. Attach the original document separately before saving.");
    } catch {
      toast.error("Unable to auto-scan document right now. Please enter details manually.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const detectedTypeLabel = detectedType ? ({
    RECEIPT: "Receipt",
    INVOICE: "Garage Invoice",
    LOGBOOK_PAGE: "Stamped Logbook Page",
    MOT_CERTIFICATE: "MOT Certificate",
    OTHER: "Other Document",
  } satisfies Record<ScannedServiceDocument["documentType"], string>)[detectedType] : undefined;

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
        capture="environment"
        className="sr-only"
        aria-label="Choose a receipt, invoice or logbook image to scan"
        onChange={(event) => void scan(event.target.files?.[0])}
      />
      <button
        type="button"
        disabled={busy}
        aria-busy={busy}
        onClick={() => canScan ? inputRef.current?.click() : setUpgradeOpen(true)}
        className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-left shadow-sm transition-all active:scale-[0.99] disabled:cursor-wait disabled:opacity-70 ${canScan ? "border-emerald-500/40 bg-gradient-to-r from-emerald-950/60 via-slate-900 to-cyan-950/60 text-emerald-100 hover:border-emerald-400/60" : "border-slate-700/60 bg-slate-900/80 text-slate-300"} ${className}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {busy ? <LoaderCircle aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin text-emerald-300" /> : canScan ? <Sparkles aria-hidden="true" className="h-4 w-4 shrink-0 animate-pulse text-emerald-300" /> : <Camera aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-300" />}
          <span className="min-w-0 break-words font-semibold">{busy ? "Analyzing document…" : "AI Auto-Scan (Receipt, Invoice, Logbook)"}</span>
        </span>
        <span className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[10px] font-bold tracking-wider ${canScan ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200" : "border-slate-600/60 bg-slate-800/80 text-slate-300"}`}>
          {canScan ? isAdmin ? <><Check aria-hidden="true" className="h-3 w-3 shrink-0" /> UNLOCKED</> : "PRO" : <><LockKeyhole aria-hidden="true" className="h-3 w-3 shrink-0" /> Upgrade</>}
        </span>
      </button>
      {detectedTypeLabel && <div role="status" className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-200">
        <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        <span className="break-words">AI Detected: {detectedTypeLabel}</span>
      </div>}
      <UpgradeDialog
        nested
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        description="Unlock AI Auto-Scanning for receipts, invoices & stamped logbook pages on Pro DIY (£0.99/mo)."
        perks={["Gemini Vision document detection", "Auto-fill service dates, mileage and work notes", "Keep every suggested field editable before saving"]}
      />
    </>
  );
}

import { useRef, useState } from "react";
import { Camera, LoaderCircle, LockKeyhole } from "lucide-react";
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
  onScanned,
  className = "",
}: {
  canScan: boolean;
  onScanned: (fields: ScannedServiceDocument, imageData?: string) => void;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  async function scan(file?: File) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Choose an image no larger than 10 MB.");
      return;
    }
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
        className={`flex min-h-12 w-full items-center justify-center gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-3 text-center font-medium text-emerald-300 transition-transform active:scale-[0.98] disabled:cursor-wait disabled:opacity-70 ${className}`}
      >
        {busy ? <LoaderCircle aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin" /> : canScan ? <Camera aria-hidden="true" className="h-4 w-4 shrink-0" /> : <LockKeyhole aria-hidden="true" className="h-4 w-4 shrink-0" />}
        <span>{busy ? "Analyzing document…" : canScan ? "Scan receipt, invoice or logbook page" : "AI Receipt & Logbook Scanner (Pro Feature)"}</span>
      </button>
      <UpgradeDialog nested open={upgradeOpen} onOpenChange={setUpgradeOpen} />
    </>
  );
}

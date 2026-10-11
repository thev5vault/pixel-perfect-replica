import { useEffect, useState } from "react";
import { Check, Clipboard, Download, ExternalLink, FileDown, LoaderCircle, LockKeyhole, Share2, X } from "lucide-react";
import QRCode from "qrcode";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plate } from "@/components/vault/ui-bits";
import { savePdf, useV1 } from "@/lib/use-v1";
import { useAccount } from "@/lib/account-store";
import type { PublicPassport } from "@/lib/v1-types";
import type { Vehicle } from "@/lib/vault-store";
import { cn } from "@/lib/utils";
type Props = { open: boolean; onOpenChange: (open: boolean) => void; vrm: string };

export function SharePassportModal({ open, onOpenChange, vrm }: Props) {
  const v1 = useV1();
  const account = useAccount();
   const isOwner = Boolean(account?.preview || account?.state?.user.role==="dev_admin" || account?.state?.vehicles.some((vehicle) => vehicle.vrm === vrm && vehicle.owner_user_id===account.state?.user.id && vehicle.access!=="archived"));
  const [snapshot, setSnapshot] = useState<PublicPassport | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!open) return;
    let active = true; setError(""); setSnapshot(null);
    void v1.getPublicPassport(vrm, v1.preview).then((data) => { if (active) { setSnapshot(data); setEnabled(data.published); } })
      .catch((e: unknown) => { if (active) setError(err(e, "Passport preview could not be loaded.")); });
    return () => { active = false; };
  }, [open, vrm, v1]);
  const publicUrl = enabled && snapshot?.published ? snapshot.public_url : "";
  async function toggleSharing(next: boolean) {
    if (next && !consent) { setError("Confirm owner consent before publishing a buyer link."); return; }
    setBusy("sharing"); setError("");
    try {
      const result = await v1.setSharing(vrm, next);
      setEnabled(result.enabled);
      if(v1.preview&&snapshot) {
        setSnapshot({...snapshot,published:next,public_url:`${window.location.origin}/v/${encodeURIComponent(vrm)}?sample=true`});
      } else if (next) {
        const updated = await v1.getPublicPassport(vrm, v1.preview);
        setSnapshot(updated);
      } else if (snapshot) setSnapshot({ ...snapshot, published: false });
    } catch (e) { setError(err(e, "Sharing preference could not be updated.")); }
    finally { setBusy(""); }
  }
  async function copyLink() {
    if (!publicUrl) return;
    try { await navigator.clipboard.writeText(publicUrl); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { setError("Clipboard access is unavailable. Copy the link from the field."); }
  }
  async function downloadGraphic() {
    if (!snapshot) return;
    setBusy("graphic"); setError("");
    try {
      if (!publicUrl) throw new Error("Enable public sharing to include a scannable buyer link.");
      const qr = await QRCode.toDataURL(publicUrl, { errorCorrectionLevel: "H", margin: 1, width: 480, color: { dark: "#13272b", light: "#ffffff" } });
      const canvas = document.createElement("canvas"); canvas.width = 1600; canvas.height = 900;
      const ctx = canvas.getContext("2d"); if (!ctx) throw new Error("This browser cannot create the listing graphic.");
      ctx.fillStyle = "#eff4ee"; ctx.fillRect(0, 0, 1600, 900);
      ctx.fillStyle = "#13272b"; ctx.fillRect(0, 0, 1600, 26);
      ctx.fillStyle = "#d5e6df"; ctx.fillRect(96, 104, 1408, 700);
      ctx.fillStyle = "#f8faf4"; ctx.fillRect(116, 124, 1368, 660);
      const logo = new Image(); logo.src = "/logo.png";
      await new Promise<void>((resolve, reject) => { logo.onload = () => resolve(); logo.onerror = () => reject(new Error("The V5Vault logo could not be loaded.")); });
      ctx.drawImage(logo, 150, 158, 92, 92);
      ctx.fillStyle="#13272b"; ctx.font="800 54px Sora, sans-serif"; ctx.fillText("V5Vault",265,224);
      ctx.fillStyle = "#52665f"; ctx.font = "600 24px Manrope, sans-serif"; ctx.fillText("BUYER PASSPORT · OWNER-SHARED RECORD", 150, 324);
      ctx.fillStyle = "#13272b"; ctx.font = "800 66px Sora, sans-serif"; ctx.fillText(`${snapshot.vehicle.make} ${snapshot.vehicle.model}`.slice(0, 34), 150, 415);
      ctx.fillStyle = "#e8c84e"; ctx.fillRect(150, 458, 390, 88); ctx.fillStyle = "#152326"; ctx.font = "bold 46px monospace"; ctx.fillText(snapshot.vehicle.vrm, 172, 518);
      ctx.fillStyle = "#52665f"; ctx.font = "500 24px Manrope, sans-serif"; ctx.fillText(`${snapshot.services.length} service records  ·  ${snapshot.verified_stamp_count} workshop stamps`, 150, 620);
      ctx.fillText("Records are not government certification.", 150, 680);
      const code = new Image(); code.src = qr; await new Promise<void>((resolve, reject) => { code.onload = () => resolve(); code.onerror = () => reject(new Error("The QR code could not be rendered.")); });
      ctx.fillStyle = "#ffffff"; ctx.fillRect(1080, 300, 310, 310); ctx.drawImage(code, 1095, 315, 280, 280);
      ctx.fillStyle = "#13272b"; ctx.font = "700 20px Manrope, sans-serif"; ctx.fillText("SCAN TO VIEW RECORD", 1110, 652);
      const link = document.createElement("a"); link.download = `${snapshot.vehicle.vrm}-v5vault-listing.png`; link.href = canvas.toDataURL("image/png"); link.click();
    } catch (e) { setError(err(e, "Listing image could not be generated.")); }
    finally { setBusy(""); }
  }
  async function downloadPdf() {
    setBusy("pdf"); setError("");
    try { savePdf(await v1.salesPdf(vrm)); }
    catch (e) { setError(err(e, "Sales PDF is unavailable. Purchase the £2.99 Sales Pack or contact an administrator.")); }
    finally { setBusy(""); }
  }
  async function buyPdf() {
    setBusy("purchase"); setError("");
    try {
      const result = await v1.checkout("sales_pack", vrm);
      if (result.url) window.location.assign(result.url);
      else setError(result.message || "Sales Pack checkout did not return a payment link.");
    } catch (e) { setError(err(e, "Sales Pack checkout could not be started.")); }
    finally { setBusy(""); }
  }
  const vehicle = snapshot?.vehicle as Vehicle | undefined;
   return <Dialog open={open} onOpenChange={onOpenChange}>
     <DialogContent showCloseButton={false} className="max-h-[90dvh] max-w-xl overflow-y-auto border-slate-800 bg-slate-950 p-0">
       <DialogHeader className="mb-4 flex flex-row items-center justify-between gap-3 space-y-0 border-b border-slate-800/80 px-5 pb-3 pt-5 text-left">
         <div className="min-w-0">
           <p className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-cyan-400">V5VAULT / BUYER SHARE</p>
           <DialogTitle className="text-lg font-bold tracking-tight text-white">Share a buyer-safe passport</DialogTitle>
           <DialogDescription className="text-xs leading-snug text-slate-400">Preview your record privately, then opt in before a public link becomes available.</DialogDescription>
         </div>
         <DialogClose className="ml-2 -mr-1 -mt-1 flex h-12 w-12 min-h-12 min-w-12 shrink-0 cursor-pointer items-center justify-center rounded-lg p-2 text-slate-400 transition-colors hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/40">
           <X aria-hidden="true" className="h-4 w-4" />
           <span className="sr-only">Close</span>
         </DialogClose>
      </DialogHeader>
      <div className="space-y-4 p-5 pb-8">
        {error && <p role="alert" className="rounded-lg border border-destructive/35 bg-destructive/10 p-3 text-sm">{error}</p>}
        {!snapshot && !error && <div className="space-y-3"><div className="h-24 animate-pulse rounded-xl bg-muted"/><div className="h-12 animate-pulse rounded-xl bg-muted"/></div>}
        {snapshot && <>
           <div className="my-3 flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900/70 p-3">
             <div className="flex min-w-0 items-center gap-2.5">{vehicle && <><Plate vrm={vehicle.vrm}/><p className="min-w-0 break-words font-semibold text-white">{vehicle.make} {vehicle.model}</p></>}</div>
             <span className="shrink-0 rounded-full border border-slate-700/60 bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300">{snapshot.is_sample ? "Sample preview" : snapshot.published ? "Public link active" : "Private preview"}</span>
          </div>
          {snapshot.is_sample && <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">Development sample only. Nothing here publishes a live vehicle or takes payment.</p>}
           {!snapshot.published && <div>
             <label className="mb-4 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-800/60 bg-slate-900/40 p-3 text-xs leading-relaxed text-slate-300 transition-colors hover:bg-slate-900/60">
               <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-700 text-cyan-500 accent-cyan-500 focus:ring-cyan-500/40" checked={consent} onChange={(e) => setConsent(e.target.checked)}/>
               <span>I am the vehicle keeper or authorised owner. I consent to making this redacted buyer passport available to anyone with its public link.</span>
             </label>
             <button type="button" className={cn("flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-all", "bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/20 hover:opacity-95", "disabled:cursor-not-allowed disabled:border-slate-700/50 disabled:bg-slate-800 disabled:text-slate-500 disabled:opacity-60 disabled:shadow-none")} disabled={!consent || busy !== "" || !isOwner} onClick={() => void toggleSharing(true)}>{busy === "sharing" ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <Share2 className="h-4 w-4"/>}Enable public buyer link</button>
          </div>}
           {snapshot.published && <div className="rounded-xl border border-success/30 bg-success/5 p-4">
             <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-success"><Check className="h-4 w-4"/>{snapshot.is_sample?"Sample buyer link · no live publication":"Public link is enabled"}</div>
            <div className="flex gap-2"><input readOnly value={publicUrl} className="field min-w-0 text-base" aria-label="Public passport URL"/><button type="button" onClick={() => void copyLink()} className="btn-ghost min-h-12 shrink-0" aria-label="Copy public link">{copied ? <Check className="h-5 w-5"/> : <Clipboard className="h-5 w-5"/>}</button></div>
            <button type="button" className="mt-3 min-h-11 text-sm text-muted-foreground underline" onClick={() => void toggleSharing(false)} disabled={busy !== ""}>Turn off public sharing</button>
          </div>}
            {<div className="grid gap-2 sm:grid-cols-2"><button type="button" className="mt-2.5 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-2.5 text-center text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800/80 disabled:opacity-50" onClick={() => void downloadGraphic()} disabled={busy !== ""||!snapshot.published}>{busy === "graphic" ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <Download className="h-4 w-4"/>}Download high-resolution listing PNG</button><button type="button" className="mt-2.5 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-2.5 text-center text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800/80 disabled:opacity-50" onClick={() => void downloadPdf()} disabled={busy !== ""}>{busy === "pdf" ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <FileDown className="h-4 w-4"/>}Download Sales Pack PDF</button></div>}
          {snapshot.published && !snapshot.is_sample && <button type="button" className="btn-primary min-h-12 w-full" onClick={() => void buyPdf()} disabled={busy !== ""}>{busy === "purchase" ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <FileDown className="h-4 w-4"/>}Purchase Sales Pack · £2.99 once</button>}
           {!snapshot.published && <div className="flex items-center gap-2 px-1 text-xs text-slate-400"><LockKeyhole className="h-4 w-4 shrink-0"/>Your private preview is not discoverable by buyers.</div>}
           <p className="px-1 text-[11px] leading-relaxed text-slate-400">The public view excludes keeper email, V5C reference and raw receipts. Workshop and MOT data is labelled by its source; no government endorsement is implied.</p>
          {publicUrl && <a href={publicUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 text-sm text-primary underline"><ExternalLink className="h-4 w-4"/>Open buyer view</a>}
        </>}
      </div>
    </DialogContent>
  </Dialog>;
}
function err(error: unknown, fallback: string) { return error instanceof Error ? error.message : fallback; }

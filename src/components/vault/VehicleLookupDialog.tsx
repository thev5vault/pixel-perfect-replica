import { useState } from "react";
import { Car, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAccount } from "@/lib/account-store";
import { useVault } from "@/lib/vault-store";
import { lookupVehicle } from "@/services/dvlaApi";
import { ModalHeader } from "./ModalHeader";
import { ModalField, MODAL_INPUT_CLASS } from "./ui-bits";

export function VehicleLookupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const account = useAccount();
  const { addVehicle } = useVault();
  const [plate, setPlate] = useState("");
  const [reference, setReference] = useState("");
  const [vin,setVin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function changeOpen(next: boolean) {
    if (!next) { setBusy(false); setError(""); setPlate(""); setReference(""); }
    onOpenChange(next);
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      if (account?.signedIn) {
        const result = await account.claimVehicle(plate, reference.replace(/\D/g, ""),vin||undefined);
        toast.success(result.message || (result.status === "approved" ? "Vehicle passport connected" : "Claim submitted for review"));
        changeOpen(false);
        return;
      }
      const result = await lookupVehicle({ data: { registrationNumber: plate } });
      addVehicle(result.vehicle);
      toast.success(result.notice);
      changeOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vehicle connection failed. Try again.");
    } finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent showCloseButton={false} className="flex max-h-[var(--dialog-max-height,90dvh)] flex-col gap-4 overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950 p-5 shadow-2xl">
        <ModalHeader className="border-0 bg-transparent px-0 py-0">
          <DialogTitle className="flex items-center gap-2"><Car className="h-5 w-5 text-cyan-400" /> Connect New Vehicle</DialogTitle>
          <DialogDescription>Link your keeper record to its vehicle history passport.</DialogDescription>
        </ModalHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain scroll-p-1 p-1">
            <ModalField label="Vehicle registration mark">{(id) => (
              <input id={id} autoFocus required minLength={2} maxLength={12} disabled={busy} value={plate} onChange={(e) => {setPlate(e.target.value.toUpperCase().replace(/[^A-Z0-9 ]/g, ""));setError("");}} placeholder="AB14 CDE" autoComplete="off" className={MODAL_INPUT_CLASS} />
            )}</ModalField>
            {account?.signedIn && <div className="space-y-1.5">
              <ModalField label="11-digit V5C logbook reference">{(id) => (
                <input id={id} required inputMode="numeric" autoComplete="off" minLength={11} maxLength={11} disabled={busy} value={reference} onChange={(e) => {setReference(e.target.value.replace(/\D/g, "").slice(0, 11));setError("");}} placeholder="11 digits on your V5C" className={MODAL_INPUT_CLASS} />
              )}</ModalField>
              <span className="block text-xs text-muted-foreground">A registration lookup alone does not prove keeper status.</span>
            </div>}
            {account?.signedIn && <div className="space-y-1.5">
              <ModalField label="VIN / chassis number on your V5C">{(id) => (
                <input id={id} value={vin} maxLength={24} onChange={e=>setVin(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g,""))} className={MODAL_INPUT_CLASS} placeholder="Chassis number (optional for samples)" />
              )}</ModalField>
              <span className="block text-xs text-muted-foreground">Live claims require supporting-document review. The document reference is never published.</span>
            </div>}
            <div className="flex gap-2 rounded-xl border border-cyan-500/20 bg-cyan-950/30 p-3 text-xs leading-relaxed text-slate-300">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
              <p><strong className="text-cyan-200">Development samples:</strong> AB14 CDE and BUL 200 use instant sample approval for testing only. No live DVLA or V5C verification is performed. Other claims may remain pending review.</p>
            </div>
            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          </div>
          <footer className="sticky bottom-0 z-20 flex-none bg-slate-950 pt-2">
            <button disabled={busy || (Boolean(account?.signedIn) && reference.length !== 11)} className="btn-primary w-full" type="submit">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? "Connecting…" : "Connect vehicle passport"}
            </button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}

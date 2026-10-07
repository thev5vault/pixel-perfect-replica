import { useState } from "react";
import { Car, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAccount } from "@/lib/account-store";
import { useVault } from "@/lib/vault-store";
import { lookupVehicle } from "@/services/dvlaApi";
import { ModalHeader } from "./ModalHeader";

export function VehicleLookupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const account = useAccount();
  const { addVehicle } = useVault();
  const [plate, setPlate] = useState("");
  const [reference, setReference] = useState("");
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
        const result = await account.claimVehicle(plate, reference.replace(/\D/g, ""));
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
      <DialogContent showCloseButton={false} className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0">
        <ModalHeader>
          <DialogTitle className="flex items-center gap-2"><Car className="h-5 w-5 text-cyan-400" /> Connect New Vehicle</DialogTitle>
          <DialogDescription>Link your keeper record to its vehicle history passport.</DialogDescription>
        </ModalHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 pb-6">
            <label className="block space-y-2">
              <span className="text-sm font-semibold">Vehicle registration mark</span>
              <input autoFocus required minLength={2} maxLength={12} disabled={busy} value={plate} onChange={(e) => {setPlate(e.target.value.toUpperCase().replace(/[^A-Z0-9 ]/g, ""));setError("");}} placeholder="AB14 CDE" autoComplete="off" className="w-full rounded-xl border-2 border-slate-950 bg-[#FACC15] px-3 py-3 text-center font-mono text-2xl font-black uppercase tracking-wider text-slate-950 placeholder:text-slate-600 focus-visible:outline-cyan-400" />
            </label>
            {account?.signedIn && <label className="block space-y-2">
              <span className="text-sm font-semibold">11-digit V5C logbook reference</span>
              <input required inputMode="numeric" autoComplete="off" minLength={11} maxLength={11} disabled={busy} value={reference} onChange={(e) => {setReference(e.target.value.replace(/\D/g, "").slice(0, 11));setError("");}} placeholder="11 digits on your V5C" className="field font-mono tracking-[0.2em]" />
              <span className="block text-xs text-muted-foreground">A registration lookup alone does not prove keeper status.</span>
            </label>}
            <div className="flex gap-2 rounded-xl border border-cyan-500/20 bg-cyan-950/30 p-3 text-xs leading-relaxed text-slate-300">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
              <p><strong className="text-cyan-200">Development samples:</strong> AB14 CDE and BUL 200 use instant sample approval for testing only. No live DVLA or V5C verification is performed. Other claims may remain pending review.</p>
            </div>
            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          </div>
          <footer className="sticky bottom-0 z-20 flex-none border-t border-slate-800 bg-slate-900 p-4">
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

import { useRef, useState } from "react";
import { Car, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useVault } from "@/lib/vault-store";
import { lookupVehicle } from "@/services/dvlaApi";
import { ModalHeader } from "./ModalHeader";

export function VehicleLookupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { addVehicle } = useVault();
  const [plate, setPlate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const request = useRef(0);
  function changeOpen(next: boolean) {
    if (!next) { request.current++; setBusy(false); setError(""); }
    onOpenChange(next);
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const current = ++request.current;
    setBusy(true);
    setError("");
    try {
      const result = await lookupVehicle({ data: { registrationNumber: plate } });
      if (current !== request.current) return;
      addVehicle(result.vehicle);
      toast.success(result.notice);
      setPlate("");
      changeOpen(false);
    } catch (err) {
      if (current === request.current) setError(err instanceof Error ? err.message : "Vehicle lookup failed. Try again.");
    } finally {
      if (current === request.current) setBusy(false);
    }
  }
  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogContent showCloseButton={false} className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0">
        <ModalHeader>
          <DialogTitle className="flex items-center gap-2"><Car className="h-5 w-5 text-cyan-400" /> Add Vehicle</DialogTitle>
          <DialogDescription>Look up a UK registration and attach it to your vehicle list.</DialogDescription>
        </ModalHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 pb-6">
          <label className="block space-y-2">
            <span className="text-sm font-semibold">Registration number</span>
            <input autoFocus required minLength={2} maxLength={12} disabled={busy}
              value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())}
              placeholder="AB14 CDE" autoComplete="off"
              className="w-full rounded-xl border-2 border-slate-950 bg-[#FACC15] px-3 py-4 text-center font-mono text-3xl font-black uppercase tracking-wider text-slate-950 placeholder:text-slate-600 focus-visible:outline-cyan-400" />
          </label>
          <p className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-xs text-slate-300">
            Without API credentials, only AB14 CDE and BUL 200 are available as clearly labelled sample vehicles. A registration lookup does not verify ownership.
          </p>
          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          </div>
          <footer className="sticky bottom-0 z-20 flex-none border-t border-slate-800 bg-slate-900 p-4">
          <button disabled={busy} className="btn-primary w-full" type="submit">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {busy ? "Looking up…" : "Lookup Vehicle"}
          </button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}

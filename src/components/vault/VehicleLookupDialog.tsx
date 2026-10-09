import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Car, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAccount } from "@/lib/account-store";
import { useVault } from "@/lib/vault-store";
import { lookupVehicle } from "@/services/dvlaApi";
import { ModalHeader } from "./ModalHeader";
import { ModalField, MODAL_INPUT_CLASS } from "./ui-bits";
import { isDevelopmentFixtureVrm, LG57_VYF, normalizeRegistration } from "@/lib/vehicle-claim-policy";

export function VehicleLookupDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const account = useAccount();
  const { addVehicle, setActiveVrm } = useVault();
  const navigate = useNavigate();
  const [plate, setPlate] = useState("");
  const [reference, setReference] = useState("");
  const [vin,setVin] = useState("");
  const [manualMode,setManualMode] = useState(false);
  const [lookupUnavailable,setLookupUnavailable] = useState(false);
  const [make,setMake] = useState("");
  const [model,setModel] = useState("");
  const [year,setYear] = useState("");
  const [odometer,setOdometer] = useState("");
  const [motExpiry,setMotExpiry] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const isLG57 = normalizeRegistration(plate) === LG57_VYF;
  const developmentFixture = Boolean(account?.state?.development) && isDevelopmentFixtureVrm(plate);
  const developmentFirstClaim = isLG57 && developmentFixture;
  function changeOpen(next: boolean) {
    if (!next) { setBusy(false); setError(""); setPlate(""); setReference(""); setVin(""); setManualMode(false); setLookupUnavailable(false); setMake(""); setModel(""); setYear(""); setOdometer(""); setMotExpiry(""); }
    onOpenChange(next);
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      if (manualMode) {
        const manuallyEnteredVehicle = {
          vrm: normalizeRegistration(plate),
          vin: vin.toUpperCase(),
          make: make.trim(),
          model: model.trim(),
          year: Number(year),
          odometer: Number(odometer),
          motExpiry,
          source: "user-provided" as const,
          verification_tier: "provisional" as const,
          v5cDate: "",
          motStatus: "Unknown",
        };
        if (!account?.signedIn) {
          addVehicle(manuallyEnteredVehicle);
          toast.success("Vehicle saved to this browser. Sign in to keep it with your account.");
        } else {
          const response = await fetch("/api/vault/create", {
            method: "POST", credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              vrm: plate, vin: manuallyEnteredVehicle.vin, make: manuallyEnteredVehicle.make,
              model: manuallyEnteredVehicle.model, year: manuallyEnteredVehicle.year,
              odometer: manuallyEnteredVehicle.odometer, motExpiry: manuallyEnteredVehicle.motExpiry,
            }),
          });
          const result = await response.json() as { error?: string; vehicle?: typeof manuallyEnteredVehicle };
          if (!response.ok) throw new Error(result.error || "Manual vehicle entry could not be saved.");
          addVehicle(result.vehicle ?? manuallyEnteredVehicle);
          toast.success("Vehicle details saved. Keeper verification is still required.");
        }
        setActiveVrm(normalizeRegistration(plate));
        changeOpen(false);
        await navigate({ to: "/vehicle" });
        return;
      }
      if (isLG57 && !account?.signedIn) {
        throw new Error("Sign in to claim LG57 VYF. Guest previews cannot bind this vehicle to an account.");
      }
      if (account?.signedIn) {
        const result = await account.claimVehicle(plate, developmentFixture ? "" : reference.replace(/\D/g, ""),vin||undefined);
        toast.success(result.message || (result.status === "approved" ? "Vehicle passport connected" : "Claim submitted for review"));
        changeOpen(false);
        if (result.status === "approved") {
          setActiveVrm(normalizeRegistration(plate));
          await navigate({ to: "/vehicle" });
        }
        return;
      }
      const result = await lookupVehicle({ data: { registrationNumber: plate } });
      addVehicle(result.vehicle);
      toast.success(result.notice);
      changeOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Vehicle connection failed. Try again.";
      if (message.includes("DVSA Live Sync pending activation")) {
        setLookupUnavailable(true);
        setManualMode(true);
        setError("");
      } else setError(message);
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
            {account?.signedIn && !developmentFixture && !manualMode && <div className="space-y-1.5">
              <ModalField label="11-digit V5C logbook reference">{(id) => (
                <input id={id} required inputMode="numeric" autoComplete="off" minLength={11} maxLength={11} disabled={busy} value={reference} onChange={(e) => {setReference(e.target.value.replace(/\D/g, "").slice(0, 11));setError("");}} placeholder="11 digits on your V5C" className={MODAL_INPUT_CLASS} />
              )}</ModalField>
              <span className="block text-xs text-muted-foreground">A registration lookup alone does not prove keeper status.</span>
            </div>}
            {account?.signedIn && <div className="space-y-1.5">
              <ModalField label="VIN / chassis number on your V5C">{(id) => (
                <input id={id} value={vin} maxLength={17} onChange={e=>setVin(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,17))} className={MODAL_INPUT_CLASS} placeholder={developmentFirstClaim ? "Optional for this development record" : "17-character VIN (samples fill automatically)"} />
              )}</ModalField>
              <span className="block text-xs text-muted-foreground">{developmentFirstClaim ? "The saved development record supplies this VIN; the first signed-in account is bound immediately." : developmentFixture ? "The development fixture supplies the VIN and V5C reference automatically." : "Live claims require supporting-document review. The document reference is never published."}</span>
            </div>}
            {lookupUnavailable && <p role="status" className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-sm text-amber-100">DVSA Live Sync pending activation — manual service entry active</p>}
            {!manualMode && <button type="button" onClick={() => setManualMode(true)} className="min-h-11 w-full rounded-xl border border-slate-700 px-3 text-sm text-slate-300 hover:bg-slate-900">
              Enter vehicle details manually
            </button>}
            {manualMode && <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/50 p-3" aria-label="Manual vehicle details">
              {!lookupUnavailable && <p className="text-xs text-slate-300">These details are user supplied and are not DVLA/DVSA verified.</p>}
              <ModalField label="Make">{(id) => <input id={id} required maxLength={80} value={make} onChange={(event) => setMake(event.target.value)} className={MODAL_INPUT_CLASS} placeholder="e.g. Audi" />}</ModalField>
              <ModalField label="Model">{(id) => <input id={id} required maxLength={120} value={model} onChange={(event) => setModel(event.target.value)} className={MODAL_INPUT_CLASS} placeholder="e.g. A4" />}</ModalField>
              <div className="grid grid-cols-2 gap-3">
                <ModalField label="Year">{(id) => <input id={id} type="number" required min={1886} max={new Date().getFullYear()+1} value={year} onChange={(event) => setYear(event.target.value)} className={MODAL_INPUT_CLASS} />}</ModalField>
                <ModalField label="Mileage">{(id) => <input id={id} type="number" required min={0} max={2000000} value={odometer} onChange={(event) => setOdometer(event.target.value)} className={MODAL_INPUT_CLASS} />}</ModalField>
              </div>
              <ModalField label="MOT expiry date">{(id) => <input id={id} type="date" required value={motExpiry} onChange={(event) => setMotExpiry(event.target.value)} className={MODAL_INPUT_CLASS} />}</ModalField>
              <p className="text-xs text-slate-400">A 17-character VIN is required. The keeper claim remains subject to V5C verification.</p>
            </section>}
            {developmentFirstClaim && <p className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-xs leading-relaxed text-amber-100">
              Development first-claim rule: one verified signed-in account can bind LG57 VYF immediately. Guest claims are blocked, and the supplied specs are not live DVLA/DVSA verified.
            </p>}
            <div className="flex gap-2 rounded-xl border border-cyan-500/20 bg-cyan-950/30 p-3 text-xs leading-relaxed text-slate-300">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
              <p><strong className="text-cyan-200">Development lookup:</strong> AB14 CDE and BUL 200 are sample vehicles. LG57 VYF uses the supplied Audi specifications and is first-claim bound to one signed-in account in development. Other real claims require V5C review.</p>
            </div>
            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          </div>
          <footer className="sticky bottom-0 z-20 flex-none bg-slate-950 pt-2">
            <button disabled={busy || (Boolean(account?.signedIn) && !developmentFixture && !manualMode && reference.length !== 11) || (manualMode && (vin.length !== 17 || !make.trim() || !model.trim() || !year || !odometer || !motExpiry))} className="btn-primary w-full" type="submit">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? "Connecting…" : "Connect vehicle passport"}
            </button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}

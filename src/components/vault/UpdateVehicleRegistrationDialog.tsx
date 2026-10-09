import { useEffect, useState, type FormEvent } from "react";
import { LoaderCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { submitVehicleReverification } from "@/services/v1Api";
import type { VehicleVerificationState } from "@/lib/vehicle-verification";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vin: string;
  currentVrm: string;
  onSubmitted: (state: VehicleVerificationState, message: string) => void;
};

export function UpdateVehicleRegistrationDialog({ open, onOpenChange, vin, currentVrm, onSubmitted }: Props) {
  const [vrm, setVrm] = useState(currentVrm);
  const [reference, setReference] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setVrm(currentVrm);
    setReference("");
    setError("");
  }, [open, currentVrm]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await submitVehicleReverification({ data: { vin, vrm, reference } });
      onSubmitted(result.verification_state, result.message);
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The re-verification request could not be submitted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto bg-slate-950 border border-slate-800 p-5 sm:rounded-2xl">
        <DialogTitle className="text-xl font-bold">Update Logbook / Plate Details</DialogTitle>
        <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
          The vehicle history remains attached to its VIN. An administrator must review the new V5C evidence before live sharing, sales-pack exports, and workshop stamps are unlocked. The 11-digit reference is stored as a keyed digest, not in readable form.
        </DialogDescription>
        <form className="mt-2 flex flex-col gap-4" onSubmit={submit}>
          <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            New vehicle registration
            <input
              required
              minLength={2}
              maxLength={12}
              autoComplete="off"
              value={vrm}
              onChange={(event) => setVrm(event.target.value.toUpperCase().replace(/[^A-Z0-9 ]/g, "").slice(0, 12))}
              className="field min-w-0 text-base font-mono uppercase"
              placeholder="AB14 CDE"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            11-digit V5C reference
            <input
              required
              inputMode="numeric"
              pattern="[0-9]{11}"
              minLength={11}
              maxLength={11}
              autoComplete="off"
              value={reference}
              onChange={(event) => setReference(event.target.value.replace(/\D/g, "").slice(0, 11))}
              className="field min-w-0 text-base font-mono"
              placeholder="11 digits from the current logbook"
            />
          </label>
          {error && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
          <p className="text-xs leading-relaxed text-muted-foreground">
            Submission puts the vehicle into a restricted verification state. A matching digit count alone does not prove keeper status; approval follows evidence review.
          </p>
          <button type="submit" className="btn-primary min-h-12 w-full" disabled={busy || !vin}>
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            Submit for V5C review
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, LoaderCircle, RefreshCw, X } from "lucide-react";
import { Pill } from "@/components/vault/ui-bits";
import { getPendingVehicleVerifications, reviewVehicleVerification } from "@/services/v1Api";

type Request = {
  id: string;
  vin: string;
  requested_vrm: string;
  current_vrm: string;
  user_id: string;
  applicant_name: string;
  applicant_email: string;
  created_at: string;
};

export function VehicleVerificationRequestsPanel() {
  const [requests, setRequests] = useState<Request[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [attested, setAttested] = useState<Record<string, boolean>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setError("");
    try {
      setRequests(await getPendingVehicleVerifications() as Request[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Re-verification requests could not be loaded.");
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  async function review(request: Request, status: "approved" | "rejected") {
    const reason = reasons[request.id]?.trim() ?? "";
    if (reason.length < 10) {
      setError("Enter a review reason of at least 10 characters.");
      return;
    }
    if (status === "approved" && !attested[request.id]) {
      setError("Confirm that you inspected supporting V5C evidence before approving.");
      return;
    }
    setBusy(request.id);
    setError("");
    try {
      await reviewVehicleVerification({
        data: { id: request.id, status, reviewed_evidence: status === "approved" && attested[request.id] === true, reason },
      });
      setRequests(current => current?.filter(item => item.id !== request.id) ?? null);
      setAttested(current => { const next = { ...current }; delete next[request.id]; return next; });
      setReasons(current => { const next = { ...current }; delete next[request.id]; return next; });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The decision could not be saved.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="vault-card overflow-hidden" aria-labelledby="vehicle-verification-title">
      <header className="border-b border-border p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Administration / vehicle identity</p>
        <h2 id="vehicle-verification-title" className="mt-1 text-xl font-bold">Pending V5C re-verification</h2>
        <p className="mt-1 text-sm text-muted-foreground">Check the current logbook and match its VRM and VIN to the immutable vehicle record. An 11-digit format check is not proof of keeper status.</p>
      </header>
      {error && <p role="alert" className="m-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm">{error}</p>}
      {!requests && !error && <p role="status" className="p-5 text-sm text-muted-foreground">Loading re-verification requests…</p>}
      {requests?.length === 0 && <div className="p-6 text-center text-sm text-muted-foreground">No vehicle re-verification requests are waiting for review.</div>}
      {!!requests?.length && <ul className="divide-y divide-border">{requests.map(request => (
        <li key={request.id} className="space-y-4 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{request.applicant_name || "Keeper"}</h3><Pill tone="warning">Evidence review required</Pill></div>
              <p className="mt-1 break-all text-sm text-muted-foreground">{request.applicant_email}</p>
              <p className="mt-2 break-all font-mono text-sm">VIN {request.vin}</p>
              <p className="mt-1 text-sm">Current VRM <span className="font-mono font-semibold">{request.current_vrm}</span> → requested <span className="font-mono font-semibold">{request.requested_vrm}</span></p>
              <p className="mt-1 text-xs text-muted-foreground">Submitted {new Date(request.created_at).toLocaleString("en-GB")}</p>
            </div>
            <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />
          </div>
          <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
            <input type="checkbox" className="mt-1 h-5 w-5 accent-primary" checked={attested[request.id] ?? false}
              onChange={event => setAttested(current => ({ ...current, [request.id]: event.target.checked }))} />
            <span>I reviewed the current V5C and confirmed the requested VRM and VIN against the vehicle identity evidence.</span>
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Decision reason · required</span>
            <textarea className="field min-h-24 text-base" maxLength={1000} value={reasons[request.id] ?? ""}
              onChange={event => setReasons(current => ({ ...current, [request.id]: event.target.value }))}
              placeholder="Record which evidence informed the decision." />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" className="btn-ghost min-h-12" onClick={() => void review(request, "rejected")} disabled={busy !== ""}>
              {busy === request.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />} Reject
            </button>
            <button type="button" className="btn-primary min-h-12" onClick={() => void review(request, "approved")}
              disabled={busy !== "" || !attested[request.id] || (reasons[request.id]?.trim().length ?? 0) < 10}>
              {busy === request.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve and verify
            </button>
          </div>
        </li>
      ))}</ul>}
      <footer className="border-t border-border p-4">
        <button type="button" onClick={() => void load()} className="inline-flex min-h-10 items-center gap-2 text-sm underline"><RefreshCw className="h-4 w-4" />Refresh requests</button>
      </footer>
    </section>
  );
}

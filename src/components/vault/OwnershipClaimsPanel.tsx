import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Check, LoaderCircle, RefreshCw, X } from "lucide-react";
import { Pill } from "@/components/vault/ui-bits";
import { useV1 } from "@/lib/use-v1";
import type { PendingOwnershipClaim } from "@/lib/v1-types";

export function OwnershipClaimsPanel() {
  const v1 = useV1();
  const [claims, setClaims] = useState<PendingOwnershipClaim[] | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [attested, setAttested] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => { setError(""); try { setClaims(await v1.getPendingClaims()); } catch (e) { setError(message(e, "Ownership claims could not be loaded.")); } }, [v1]);
  useEffect(() => { void load(); }, [load]);
  async function review(claim: PendingOwnershipClaim, status: "approved" | "rejected") {
    const reason = reasons[claim.id]?.trim() ?? "";
    if (reason.length < 10) { setError("Add a review reason of at least 10 characters."); return; }
    if (status === "approved" && !attested[claim.id]) { setError("Attest that you reviewed supporting evidence before approving."); return; }
    setBusy(claim.id); setError("");
    try {
      await v1.reviewClaim({ id: claim.id, status, reviewed_evidence: status === "approved" ? true : attested[claim.id] === true, reason });
      await load();
    } catch (e) { setError(message(e, "This claim could not be reviewed.")); }
    finally { setBusy(""); }
  }
  return <section className="vault-card overflow-hidden">
    <header className="border-b border-border p-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Administration / review</p><h2 className="mt-1 text-xl font-bold">Pending ownership claims</h2><p className="mt-1 text-sm text-muted-foreground">Review documentary evidence; registration digits alone never establish ownership.</p></header>
    {error && <div role="alert" className="m-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm"><p>{error}</p>{!claims && <button type="button" onClick={() => void load()} className="mt-2 inline-flex min-h-10 items-center gap-2 underline"><RefreshCw className="h-4 w-4"/>Retry claims</button>}</div>}
    {!claims && !error && <div role="status" className="space-y-3 p-4">{[1,2].map((n) => <div key={n} className="h-40 animate-pulse rounded-xl bg-muted/60"/>)}</div>}
    {claims && claims.length === 0 && <div className="flex flex-col items-center px-5 py-10 text-center"><Check className="h-9 w-9 text-primary"/><h3 className="mt-3 font-bold">No claims awaiting review</h3><p className="mt-1 text-sm text-muted-foreground">New requests will appear here after submission.</p></div>}
    {claims && claims.length > 0 && <ul className="divide-y divide-border">{claims.map((claim) => <li key={claim.id} className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{claim.applicant_name}</h3><Pill tone={claim.is_sample ? "warning" : "muted"}>{claim.is_sample ? "Sample claim" : "Pending"}</Pill></div><p className="mt-1 break-all text-sm text-muted-foreground">{claim.applicant_email}</p><p className="mt-2 font-mono text-sm">VRM {claim.vrm} · VIN ending {claim.vin.slice(-4).padStart(Math.min(4, claim.vin.length), "•")}</p><p className="mt-1 text-xs text-muted-foreground">Submitted {date(claim.created_at)}</p></div><AlertTriangle className="h-5 w-5 text-warning"/></div>
      <label className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm"><input type="checkbox" className="mt-1 h-5 w-5 accent-primary" checked={attested[claim.id] ?? false} onChange={(e) => setAttested({ ...attested, [claim.id]: e.target.checked })}/><span>I reviewed supporting evidence that is sufficient to establish a legitimate keeper or ownership request. The VRM or matching digits alone are not evidence.</span></label>
      <label className="block space-y-1.5"><span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Decision reason · required</span><textarea className="field min-h-24 text-base" maxLength={1000} value={reasons[claim.id] ?? ""} onChange={(e) => setReasons({ ...reasons, [claim.id]: e.target.value })} placeholder="Record what evidence informed the decision."/></label>
      <div className="grid grid-cols-2 gap-2"><button type="button" className="btn-ghost min-h-12" onClick={() => void review(claim, "rejected")} disabled={busy !== ""}>{busy === claim.id ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <X className="h-4 w-4"/>}Reject claim</button><button type="button" className="btn-primary min-h-12" onClick={() => void review(claim, "approved")} disabled={busy !== "" || !(attested[claim.id] ?? false)}>{busy === claim.id ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <Check className="h-4 w-4"/>}Approve claim</button></div>
    </li>)}</ul>}
    <footer className="border-t border-border p-4"><button type="button" onClick={() => void load()} className="inline-flex min-h-10 items-center gap-2 text-sm underline"><RefreshCw className="h-4 w-4"/>Refresh claims</button></footer>
  </section>;
}
function date(value: string) { const d = new Date(value); return Number.isNaN(d.getTime()) ? value : d.toLocaleString("en-GB"); }
function message(error: unknown, fallback: string) { return error instanceof Error ? error.message : fallback; }

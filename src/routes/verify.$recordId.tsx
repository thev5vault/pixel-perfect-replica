import { createFileRoute, useParams } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BadgeCheck, Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import { verifyWorkshopStamp } from "@/services/accountApi";
import { Pill, PageHeader } from "@/components/vault/ui-bits";

type StampResult = {
  valid?: boolean; verified?: boolean; is_sample?: boolean; is_verified_stamp?: boolean;
  stamp_signature?: string | null; signature?: string | null; garage?: string; garage_name?: string;
  stamp_authority?: "workshop" | "administrator";
  vrm?: string; date?: string; mileage?: number; description?: string; category?: string;
  record?: StampResult;
};
export const Route = createFileRoute("/verify/$recordId")({ component: VerifyPage });

function VerifyPage() {
  const { recordId } = useParams({ from: "/verify/$recordId" });
  const [result, setResult] = useState<StampResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  async function load() {
    setBusy(true); setError("");
    try { setResult(await verifyWorkshopStamp({ data: { id: recordId } }) as StampResult); }
    catch (e) { setError(e instanceof Error ? e.message : "Stamp verification is unavailable."); }
    finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, [recordId]);
  const stamp = result?.record ?? result;
  const valid = result?.valid === true;
  const sample = stamp?.is_sample === true || result?.is_sample === true;
  return <main className="min-h-[100dvh] bg-slate-950 px-4 py-8"><div className="mx-auto max-w-xl">
    <PageHeader icon={<ShieldCheck className="h-5 w-5 text-primary" />} title="Record signature verification" subtitle="Public record signature lookup." />
    {busy ? <div className="vault-card animate-pulse space-y-3 p-6"><div className="h-4 w-2/3 rounded bg-slate-700" /><div className="h-3 w-1/2 rounded bg-slate-700" /><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : error ? <div className="vault-card p-6"><p role="alert" className="text-sm text-red-200">{error}</p><button onClick={() => void load()} className="btn-ghost mt-4">Retry verification</button></div> : !valid ? <div className="vault-card p-6"><Pill tone="warning"><TriangleAlert className="h-3 w-3" /> Stamp not verified</Pill><p className="mt-3 text-sm text-muted-foreground">No valid workshop stamp was confirmed for this record ID.</p></div> : <section className="vault-card space-y-4 p-6">
      <Pill tone="success"><BadgeCheck className="h-3 w-3" /> VALID — Cryptographic signature matches</Pill>
      {sample ? <div className="rounded-xl border border-amber-400/25 bg-amber-950/30 p-3 text-sm text-amber-100"><p className="flex items-center gap-2 font-semibold"><TriangleAlert className="h-4 w-4" /> Development sample record</p><p className="mt-1 text-xs leading-relaxed">This development stamp is not live VAT registration verification.</p></div> : stamp?.stamp_authority==="administrator" ? <Pill tone="success"><BadgeCheck className="h-3 w-3" /> Administrator-signed record — no garage VAT verification implied</Pill> : <Pill tone="success"><BadgeCheck className="h-3 w-3" /> Verified Workshop Stamp{(stamp?.garage_name || stamp?.garage) ? ` - ${stamp.garage_name ?? stamp.garage} (VAT Reg Verified)` : ""}</Pill>}
      <h2 className="text-xl font-bold">{stamp?.description || "Workshop service record"}</h2>
      <dl className="grid grid-cols-2 gap-3 text-sm">{stamp?.vrm && <div><dt className="text-xs text-muted-foreground">Registration</dt><dd className="mt-1 font-mono font-bold">{stamp.vrm}</dd></div>}{stamp?.date && <div><dt className="text-xs text-muted-foreground">Date</dt><dd className="mt-1">{new Date(`${stamp.date}T00:00:00`).toLocaleDateString("en-GB")}</dd></div>}{stamp?.mileage != null && <div><dt className="text-xs text-muted-foreground">Mileage</dt><dd className="mt-1">{stamp.mileage.toLocaleString("en-GB")} mi</dd></div>}{stamp?.category && <div><dt className="text-xs text-muted-foreground">Category</dt><dd className="mt-1">{stamp.category}</dd></div>}</dl>
      {(stamp?.stamp_signature || stamp?.signature) && <div className="border-t border-slate-700 pt-3"><p className="text-xs text-muted-foreground">Cryptographic signature</p><code className="mt-1 block break-all font-mono text-xs">{stamp.stamp_signature ?? stamp.signature}</code></div>}
      {sample && <Pill>Development sample · VAT not live verified</Pill>}
    </section>}
  </div></main>;
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BadgeCheck, Check, FileText, ShieldCheck, Timer, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAccount } from "@/lib/account-store";
import { formatVrm, readImage, today } from "@/lib/vault-store";
import { Field, ImagePicker, PageHeader, Pill } from "@/components/vault/ui-bits";

const JOBS = ["Oil & Filter", "Air Filter", "Pollen Filter", "Spark Plugs", "Brake Fluid", "Tyres", "Health Check"];
export const Route = createFileRoute("/garage")({ component: GaragePage });

function GaragePage() {
  const account = useAccount();
  const user = account?.state?.user;
  const canStamp = user?.role === "verified_garage" && user.garage_verified;
  const [vrm, setVrm] = useState("");
  const [mileage, setMileage] = useState("");
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [invoice, setInvoice] = useState<{ name: string; data: string }>();
  const [receipt, setReceipt] = useState<string>();
  const [fileError, setFileError] = useState("");
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [readingAttachment, setReadingAttachment] = useState(false);
  async function readAttachment(file?: File) {
    if (!file) return;
    setReadingAttachment(true);
    setFileError("");
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error("Please use an attachment smaller than 5 MB.");
      if (file.type.startsWith("image/")) setReceipt(await readImage(file));
      else await readInvoice(file);
    } catch (error) { setFileError(error instanceof Error ? error.message : "The attachment could not be read."); }
    finally { setReadingAttachment(false); }
  }
  function toggle(job: string) { setSelected((prev) => prev.includes(job) ? prev.filter((x) => x !== job) : [...prev, job]); }
  async function readInvoice(file?: File) {
    setFileError("");
    if (!file) { setInvoice(undefined); return; }
    if (file.type !== "application/pdf" || file.size > 5 * 1024 * 1024) {
      setInvoice(undefined); setFileError("Choose a PDF no larger than 5 MB."); return;
    }
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("The invoice could not be read."));
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("The invoice could not be read."));
        reader.readAsDataURL(file);
      });
      setInvoice({ name: file.name.slice(0, 200), data });
    } catch (error) { setFileError(error instanceof Error ? error.message : "The invoice could not be read."); }
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || readingAttachment) return;
    if (!account || !user) return;
    const mi = Number(mileage);
    const n = vrm.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!n || !Number.isInteger(mi) || mi < 0 || mi > 2_000_000 || (!selected.length && !notes.trim())) {
      toast.error("Enter a valid registration, mileage and at least one job or work note."); return;
    }
    if (!canStamp) { toast.error("Only a server-verified workshop can stamp a record."); return; }
    setBusy(true); setSubmitted(false);
    try {
      const noteLines = notes.trim().split(/\n+/).map((x) => x.trim()).filter(Boolean);
      const description = (selected[0] ?? noteLines[0] ?? "Workshop job").slice(0, 80);
      const items = [...selected.filter((job) => job !== description), ...noteLines.filter((line) => line !== description)].slice(0, 30);
      await account.addService({
        vrm: n, date: today(), mileage: mi, category: "Servicing", description, items,
        garage: user.garage_name.trim() || "Workshop", cost: undefined, verified: false,
        invoice_name: invoice?.name, invoice_data: invoice?.data, image: receipt,
      });
      setSubmitted(true);
      toast.success("Service record submitted to the vehicle timeline");
      setVrm(""); setMileage(""); setNotes(""); setSelected([]); setInvoice(undefined); setReceipt(undefined);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Record could not be stamped"); }
    finally { setBusy(false); }
  }
  return <div className="space-y-5">
    <PageHeader icon={<Timer className="h-5 w-5 text-primary" />} title="Workshop terminal" subtitle="Fast-log an independent workshop job to a customer's vehicle passport." />
    <section className="vault-card flex flex-wrap items-center justify-between gap-4 p-4">
      <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Workshop</p><h2 className="mt-1 truncate text-lg font-bold">{user?.garage_name || "Workshop profile"}</h2><p className="mt-1 text-xs text-muted-foreground">Registration {user?.garage_registration || "not provided"}</p></div>
      <Pill tone={user?.garage_verified ? "success" : "warning"}>{user?.garage_verified ? <><BadgeCheck className="h-3 w-3" /> Server verified</> : "Verification not confirmed"}</Pill>
      {user?.is_sample && <p className="w-full rounded-lg border border-amber-400/25 bg-amber-950/30 p-2.5 text-xs text-amber-100">Development sample workshop account. This is not live VAT registration verification.</p>}
    </section>
    {submitted && <div className="vault-card flex items-center gap-3 border-success/30 p-4"><ShieldCheck className="h-6 w-6 text-success" /><div><p className="font-semibold">Record submitted</p><p className="text-xs text-muted-foreground">Stamp status and verification signature are assigned by the server.</p></div></div>}
    {!canStamp && <div className="rounded-xl border border-amber-500/25 bg-amber-950/30 p-4 text-sm leading-relaxed text-amber-100">Stamping is unavailable until the server confirms a verified workshop account. Saving workshop name or registration details does not grant verification.</div>}
    <form onSubmit={submit} className="vault-card space-y-4 p-5">
      <div className="flex items-center gap-2 text-xs font-semibold text-primary"><Timer className="h-4 w-4" /> Fast log</div>
      <div className="grid grid-cols-2 gap-3"><Field label="Customer VRM"><input required minLength={2} maxLength={12} value={vrm} onChange={(e) => setVrm(formatVrm(e.target.value).slice(0,8))} placeholder="AB14 CDE" className="field font-mono uppercase" /></Field><Field label="Odometer (mi)"><input required inputMode="numeric" value={mileage} onChange={(e) => setMileage(e.target.value.replace(/\D/g,"").slice(0,7))} placeholder="87,420" className="field" /></Field></div>
      <div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">One-tap jobs</p><div className="mt-2 grid grid-cols-2 gap-2">{JOBS.map((job) => <button key={job} type="button" aria-pressed={selected.includes(job)} onClick={() => toggle(job)} className={`flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-left text-xs font-semibold transition-colors ${selected.includes(job) ? "border-primary bg-primary/15 text-primary" : "border-slate-700 text-muted-foreground hover:border-slate-500"}`}><span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selected.includes(job) ? "border-primary bg-primary text-primary-foreground" : "border-slate-600"}`}>{selected.includes(job) && <Check className="h-3 w-3" />}</span>{job}</button>)}</div></div>
      <Field label="Work notes / receipt reference"><textarea rows={2} maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional job detail or receipt reference" className="field" /></Field>
      <div className="space-y-1.5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Workshop invoice (optional)</p><label onDragOver={(e)=>e.preventDefault()} onDrop={(e)=>{e.preventDefault();void readAttachment(e.dataTransfer.files[0]);}} className="flex min-h-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-600 p-4 text-sm text-muted-foreground hover:border-primary hover:text-primary"><FileText className="h-5 w-5" />{readingAttachment ? "Reading attachment…" : invoice ? invoice.name : "Drop an invoice photo or PDF · maximum 5 MB"}<input type="file" accept="application/pdf,.pdf,image/*" className="sr-only" disabled={readingAttachment || busy} onChange={(e) => void readAttachment(e.target.files?.[0])} /></label>{fileError && <p role="alert" className="mt-1 text-xs text-red-300">{fileError}</p>}{invoice && <button type="button" onClick={() => setInvoice(undefined)} className="mt-1 text-xs text-muted-foreground underline">Remove attachment</button>}</div>
      <div className="space-y-1.5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Receipt photo (optional)</p><ImagePicker value={receipt} onChange={setReceipt} label="Attach receipt photo" /></div>
      <p className="text-xs leading-relaxed text-muted-foreground">A record is immutable after creation. The server decides stamp provenance; incoming client flags cannot self-assert verification.</p>
      <button type="submit" disabled={busy || readingAttachment || !canStamp} className="btn-primary w-full py-4"><Upload className="h-5 w-5" />{busy ? "Submitting verified record…" : "Stamp Verified Job to Vehicle Timeline"}</button>
    </form>
  </div>;
}

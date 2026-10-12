import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Lock, Plus, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ModalHeader } from "@/components/vault/ModalHeader";
import { MOD_CATEGORIES, can, fmtDate, fmtMiles, today, useVault, type ModCategory, type Modification } from "@/lib/vault-store";
import { DocumentPrivacyNotice, Field, ImagePicker, ModalField, ModalFieldGroup, MODAL_INPUT_CLASS, MODAL_SELECT_CLASS, MODAL_TEXTAREA_CLASS, Pill, Thumb } from "@/components/vault/ui-bits";
import { FeatureLock } from "@/components/vault/FeatureLock";
import { cn } from "@/lib/utils";
import { useAccount } from "@/lib/account-store";
import { VehicleLookupDialog } from "@/components/vault/VehicleLookupDialog";
import { AIScanButton, isoDateFromUkDate } from "@/components/service/AIScanButton";
import { PdfReceiptPicker } from "@/components/vault/PdfReceiptPicker";

export const Route = createFileRoute("/vault")({
  head: () => ({
    meta: [
      { title: "Modder's Vault — V5Vault Pro" },
      { name: "description", content: "Log every modification, dyno sheet and power gain — and keep a diagnostic history of parts reverted to stock." },
      { property: "og:title", content: "Modder's Vault — V5Vault Pro" },
      { property: "og:description", content: "The build sheet for your car: active mods, dyno proof and reverted-part history." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VaultPage,
});

function VaultPage() {
  const { role } = useVault();
  const account = useAccount();
  const [connectOpen, setConnectOpen] = useState(false);

  if (account?.signedIn && account.state && account.state.vehicles.length === 0) {
    return <div className="vault-card p-6"><h1 className="text-xl font-bold">Connect a vehicle before building its mod history.</h1><p className="mt-2 text-sm text-muted-foreground">A modification log belongs to a linked vehicle passport.</p><button onClick={() => setConnectOpen(true)} className="btn-primary mt-5">Connect New Vehicle</button><VehicleLookupDialog open={connectOpen} onOpenChange={setConnectOpen} /></div>;
  }

  return (
    <div>
      {!can.vault(role) ? <FeatureLock feature="vault" /> : <ProVault />}
    </div>
  );
}

function ProVault() {
  const { mods, vehicle } = useVault();
  const [adding, setAdding] = useState(false);
  const [reverting, setReverting] = useState<Modification | null>(null);
  const vehicleMods = (Array.isArray(mods) ? mods : []).filter((m) => m?.vrm === vehicle.vrm);
  const diagnosticLogs = vehicleMods.filter((m) => m.status === "reverted");
  const activeMods = vehicleMods.filter((m) => m.status === "active");

  return (
    <div className="space-y-5 pb-40">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <span className="rounded-lg bg-primary/15 p-1.5 text-primary glow">
            <Lock className="h-5 w-5 animate-shield" />
          </span>
          Pro Tier: Modder's Vault
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Every part, every gain, every reversal — on record.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Active Build</h2>
        <button onClick={() => setAdding(true)} className="btn-primary min-h-[44px] w-full">
          <Plus className="h-5 w-5" /> Add Modification
        </button>
        {activeMods.map((m) => (
          <ModCard key={m.id} m={m} onRevert={() => setReverting(m)} />
        ))}
        {activeMods.length === 0 && <div className="vault-card p-6 text-center text-sm text-muted-foreground">No active modifications. Your car is running stock.</div>}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Diagnostic History</h2>
        <div className="space-y-3">
          {diagnosticLogs.map((m) => <ModCard key={m.id} m={m} onRevert={() => setReverting(m)} />)}
          {diagnosticLogs.length === 0 && <div className="vault-card p-6 text-center text-sm text-muted-foreground">No diagnostic fault codes or scan logs recorded yet.</div>}
        </div>
      </section>

      <AddModDialog open={adding} onOpenChange={setAdding} />
      <RevertDialog mod={reverting} onClose={() => setReverting(null)} />
    </div>
  );
}

function ModCard({ m, onRevert }: { m: Modification; onRevert: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const reverted = m.status === "reverted";
  return (
    <article className={cn("vault-card animate-vault-open p-4", reverted && "opacity-90")}>
      <p className="break-words text-xs text-muted-foreground">{m.category} · Installed {fmtDate(m.installDate)} · {fmtMiles(m.installMileage)}</p>
      <h3 className="mt-1 break-words text-lg font-bold hyphens-auto">{m.name}</h3>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {m.stage && <Pill tone="success">{m.stage}</Pill>}
        {reverted && <Pill tone="warning">Reverted</Pill>}
        {m.gains && <Pill tone="primary">{m.gains}</Pill>}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t pt-2">
        {reverted ? <span className="break-words text-xs font-semibold text-warning">Removed {m.removalDate ? `${fmtDate(m.removalDate)} · ${fmtMiles(m.removalMileage ?? 0)}` : ""}</span> : <span className="text-xs text-muted-foreground">Modification record</span>}
        <button type="button" aria-expanded={expanded} onClick={() => setExpanded((open) => !open)} className="flex min-h-[44px] min-w-[44px] shrink-0 items-center gap-1 rounded-lg border border-slate-800 bg-slate-900/80 px-3 text-xs font-semibold text-cyan-400">
          {expanded ? "Hide Details ˄" : "Details ˅"}
        </button>
      </div>
      {expanded && <div className="mt-3 space-y-2 rounded-xl border border-slate-800 bg-slate-950/80 p-3">
        {m.specs && <p className="break-words text-sm hyphens-auto">{m.specs}</p>}
        {m.tags?.length ? <div className="flex flex-wrap gap-1.5">{m.tags.map((tag) => <Pill key={tag}>{tag}</Pill>)}</div> : null}
        {m.notes && <p className="break-words text-sm text-muted-foreground hyphens-auto">{m.notes}</p>}
        {m.image && <Thumb src={m.image} alt={`${m.name} dyno sheet`} />}
        {m.invoice_data && <a href={m.invoice_data} download={m.invoice_name || "modification-invoice.pdf"} className="inline-flex min-h-[44px] max-w-full items-center break-all text-sm text-cyan-300 underline underline-offset-2">PDF Document · {m.invoice_name || "Download evidence"}</a>}
        {!reverted && !m.frozen_at && <button onClick={onRevert} className="btn-ghost min-h-[44px] w-full text-sm"><RotateCcw className="h-4 w-4" /> Revert to Stock</button>}
      </div>}
    </article>
  );
}

function AddModDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { addMod, vehicle, role } = useVault();
  const empty = { name: "", category: "Engine/ECU" as ModCategory, installDate: today(), installMileage: "", gains: "", notes: "", stage: "Stage 1", specs: "", tags: "" };
  const [f, setF] = useState(empty);
  const [image, setImage] = useState<string>();
  const [pdf, setPdf] = useState<{ name: string; data: string }>();
  const [readingPdf, setReadingPdf] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const mi = parseInt(f.installMileage, 10);
    if (!f.name.trim() || !Number.isFinite(mi)) { toast.error("Part name and install mileage are required."); return; }
    setBusy(true);
    try {
    await addMod({
      vrm: vehicle.vrm,
      name: f.name.trim().slice(0, 80),
      category: f.category,
      installDate: f.installDate,
      installMileage: mi,
      gains: f.gains.trim().slice(0, 60),
      notes: f.notes.trim().slice(0, 1000),
      image,
      invoice_name: pdf?.name,
      invoice_data: pdf?.data,
      stage: f.category === "Engine/ECU" ? f.stage : undefined,
      specs: f.specs.trim().slice(0, 200) || undefined,
      tags: f.tags.split(",").map((t) => t.trim().slice(0, 40)).filter(Boolean).slice(0, 5),
    });
    toast.success(`${f.name} added to your build`);
    setF(empty);
    setImage(undefined);
    setPdf(undefined);
    onOpenChange(false);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Modification could not be saved"); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="flex max-h-[90dvh] flex-col gap-4 overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950 p-5 shadow-2xl">
        <ModalHeader className="border-0 bg-transparent px-0 py-0">
          <DialogTitle>Add Modification</DialogTitle>
          <DialogDescription>Record the part, installation details and supporting evidence.</DialogDescription>
        </ModalHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-1">
          <DocumentPrivacyNotice />
          <AIScanButton canScan={can.diy(role)} isAdmin={role === "superadmin"} onScanned={(fields, scannedImage) => {
            setF((current) => ({
              ...current,
              name: fields.garageName ? `${fields.category} · ${fields.garageName}`.slice(0, 80) : current.name,
              installDate: isoDateFromUkDate(fields.date) ?? current.installDate,
              installMileage: fields.mileage ? String(fields.mileage) : current.installMileage,
              notes: fields.workSummary || current.notes,
            }));
            if (scannedImage) setImage(scannedImage);
          }} />
          <ModalField label="Part Name">{(id) => (
            <input id={id} required maxLength={80} value={f.name} onChange={set("name")} placeholder="Stage 2 ECU Remap" className={MODAL_INPUT_CLASS} />
          )}</ModalField>
          <ModalField label="Category" select>{(id) => (
            <select id={id} value={f.category} onChange={set("category")} className={MODAL_SELECT_CLASS}>
              {MOD_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          )}</ModalField>
          {f.category === "Engine/ECU" && (
            <ModalField label="ECU Stage" select>{(id) => (
              <select id={id} value={f.stage} onChange={set("stage")} className={MODAL_SELECT_CLASS}>
                {["Stage 1", "Stage 2", "Stage 2+", "Stage 3", "Custom"].map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            )}</ModalField>
          )}
          {(f.category === "Suspension" || f.category === "Exhaust") && (
            <ModalField label={f.category === "Suspension" ? "Suspension Specs" : "Exhaust Specs"}>{(id) => (
              <input id={id} maxLength={200} value={f.specs} onChange={set("specs")} placeholder={f.category === "Suspension" ? "KW V3 coilovers · -35mm F/R · 16 clicks rebound" : "Milltek 3\" downpipe-back · non-resonated"} className={MODAL_INPUT_CLASS} />
            )}</ModalField>
          )}
          <div className="grid grid-cols-2 gap-3 w-full min-w-0 my-3">
            <ModalField label="Install Date">{(id) => (
              <input id={id} type="date" required max={today()} value={f.installDate} onChange={set("installDate")} className={MODAL_INPUT_CLASS} />
            )}</ModalField>
            <ModalField label="Install Mileage">{(id) => (
              <input id={id} inputMode="numeric" required value={f.installMileage} onChange={(e) => setF((s) => ({ ...s, installMileage: e.target.value.replace(/\D/g, "") }))} placeholder="87,420" className={MODAL_INPUT_CLASS} />
            )}</ModalField>
          </div>
          <ModalField label="Horsepower / Torque Gains">{(id) => (
            <input id={id} maxLength={60} value={f.gains} onChange={set("gains")} placeholder="+50 bhp / +80 Nm" className={MODAL_INPUT_CLASS} />
          )}</ModalField>
          <ModalField label="Specialist Tags (comma separated)">{(id) => (
            <input id={id} maxLength={200} value={f.tags} onChange={set("tags")} placeholder="Tuned by Apex Performance, Dyno verified" className={MODAL_INPUT_CLASS} />
          )}</ModalField>
          <div className="grid grid-cols-2 gap-3">
            <ModalFieldGroup label="Dyno Curve Printout">
              <ImagePicker value={image} onChange={setImage} label="Photo / Image" />
            </ModalFieldGroup>
            <ModalFieldGroup label="Supporting PDF">
              <PdfReceiptPicker onChange={setPdf} onReadingChange={setReadingPdf} label="PDF Document" />
            </ModalFieldGroup>
          </div>
          <ModalField label="Detailed Notes">{(id) => (
            <textarea id={id} rows={3} maxLength={1000} value={f.notes} onChange={set("notes")} placeholder="Supporting mods, fuel requirements, tuner…" className={MODAL_TEXTAREA_CLASS} />
          )}</ModalField>
          </div>
          <footer className="sticky bottom-0 z-20 flex-none bg-slate-950 pt-2">
            <button type="submit" disabled={busy || readingPdf} className="btn-primary min-h-[44px] w-full">{readingPdf ? "Reading PDF…" : busy ? "Saving…" : "Add to Active Build"}</button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RevertDialog({ mod, onClose }: { mod: Modification | null; onClose: () => void }) {
  const { revertMod } = useVault();
  const [date, setDate] = useState(today());
  const [mileage, setMileage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const mi = parseInt(mileage, 10);
    if (!mod || !Number.isFinite(mi)) { return; }
    if (mi < mod.installMileage) { toast.error("Removal mileage can't be lower than install mileage."); return; }
    setBusy(true);
    try {
      await revertMod(mod.id, date, mi);
      toast.success(`${mod.name} moved to Diagnostic History`);
      setMileage("");
      onClose();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Modification could not be reverted"); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={!!mod} onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton={false}>
        <ModalHeader>
          <DialogTitle>Revert to Stock</DialogTitle>
          <DialogDescription>
            {mod?.name} will be logged in Diagnostic History for future engine diagnostics.
          </DialogDescription>
        </ModalHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 pb-6">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Removal Date">
              <input type="date" required min={mod?.installDate} max={today()} value={date} onChange={(e) => setDate(e.target.value)} className="field appearance-none [-webkit-appearance:none]" />
            </Field>
            <Field label="Removal Mileage">
              <input inputMode="numeric" required value={mileage} onChange={(e) => setMileage(e.target.value.replace(/\D/g, ""))} placeholder="87,420" className="field" />
            </Field>
          </div>
          </div>
          <footer className="sticky bottom-0 z-20 flex-none border-t border-slate-800 bg-slate-900 p-4">
          <button type="submit" disabled={busy} className="btn-primary w-full">
            <RotateCcw className="h-4 w-4" /> Confirm Revert
          </button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}

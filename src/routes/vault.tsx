import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { History, Lock, Plus, RotateCcw, Zap } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MOD_CATEGORIES, fmtDate, fmtMiles, today, useVault, type ModCategory, type Modification } from "@/lib/vault-store";
import { Field, ImagePicker, Pill, Thumb } from "@/components/vault/ui-bits";
import { FeatureLock } from "@/components/vault/FeatureLock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/vault")({
  head: () => ({
    meta: [
      { title: "Modder's Vault — V5Vault Pro" },
      { name: "description", content: "Log every modification, dyno sheet and power gain — and keep a diagnostic history of parts reverted to stock." },
      { property: "og:title", content: "Modder's Vault — V5Vault Pro" },
      { property: "og:description", content: "The build sheet for your car: active mods, dyno proof and reverted-part history." },
    ],
  }),
  component: VaultPage,
});

function VaultPage() {
  const { role } = useVault();

  if (role !== "Pro" && role !== "superadmin") return <FeatureLock feature="vault" />;

  return <ProVault />;
}

function ProVault() {
  const { mods, vehicle } = useVault();
  const [tab, setTab] = useState<"active" | "reverted">("active");
  const [adding, setAdding] = useState(false);
  const [reverting, setReverting] = useState<Modification | null>(null);
  const list = mods.filter((m) => m.vrm === vehicle.vrm && m.status === tab);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <span className="rounded-lg bg-primary/15 p-1.5 text-primary glow">
            <Lock className="h-5 w-5 animate-shield" />
          </span>
          Pro Tier: Modder's Vault
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Every part, every gain, every reversal — on record.</p>
      </div>

      <div className="grid grid-cols-2 rounded-xl border bg-card p-1">
        {(
          [
            ["active", "Active Build", Zap],
            ["reverted", "Diagnostic History", History],
          ] as const
        ).map(([k, label, Icon]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold transition-all",
              tab === k ? "bg-primary text-primary-foreground glow" : "text-muted-foreground",
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === "active" && (
        <button onClick={() => setAdding(true)} className="btn-primary w-full">
          <Plus className="h-5 w-5" /> Add Modification
        </button>
      )}

      <div className="space-y-3">
        {list.map((m) => (
          <ModCard key={m.id} m={m} onRevert={() => setReverting(m)} />
        ))}
        {list.length === 0 && (
          <p className="vault-card p-6 text-center text-sm text-muted-foreground">
            {tab === "active" ? "No active modifications. Your car is running stock." : "No reverted parts logged yet."}
          </p>
        )}
      </div>

      <AddModDialog open={adding} onOpenChange={setAdding} />
      <RevertDialog mod={reverting} onClose={() => setReverting(null)} />
    </div>
  );
}

function ModCard({ m, onRevert }: { m: Modification; onRevert: () => void }) {
  const reverted = m.status === "reverted";
  return (
    <article className={cn("vault-card animate-vault-open p-4", reverted && "opacity-90")}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-1.5">
            <Pill tone="primary">{m.category}</Pill>
            {reverted && <Pill tone="warning">Reverted</Pill>}
          </div>
          <h3 className="mt-1.5 text-lg font-bold">{m.name}</h3>
          {m.gains && (
            <p className="flex items-center gap-1 font-display text-sm font-bold text-success">
              <Zap className="h-3.5 w-3.5" /> {m.gains}
            </p>
          )}
        </div>
        {m.image && <Thumb src={m.image} alt={`${m.name} dyno sheet`} />}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 border-t pt-3 text-xs">
        <div>
          <dt className="text-muted-foreground">Installed</dt>
          <dd className="font-semibold">
            {fmtDate(m.installDate)} · {fmtMiles(m.installMileage)}
          </dd>
        </div>
        {reverted && m.removalDate && (
          <div>
            <dt className="text-muted-foreground">Removed</dt>
            <dd className="font-semibold text-warning">
              {fmtDate(m.removalDate)} · {fmtMiles(m.removalMileage ?? 0)}
            </dd>
          </div>
        )}
      </dl>
      {m.notes && <p className="mt-2 text-sm text-muted-foreground">{m.notes}</p>}
      {!reverted && (
        <button onClick={onRevert} className="btn-ghost mt-3 w-full text-sm">
          <RotateCcw className="h-4 w-4" /> Revert to Stock
        </button>
      )}
    </article>
  );
}

function AddModDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { addMod, vehicle } = useVault();
  const empty = { name: "", category: "Engine/ECU" as ModCategory, installDate: today(), installMileage: "", gains: "", notes: "" };
  const [f, setF] = useState(empty);
  const [image, setImage] = useState<string>();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF((s) => ({ ...s, [k]: e.target.value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const mi = parseInt(f.installMileage, 10);
    if (!f.name.trim() || !Number.isFinite(mi)) { toast.error("Part name and install mileage are required."); return; }
    addMod({
      vrm: vehicle.vrm,
      name: f.name.trim().slice(0, 80),
      category: f.category,
      installDate: f.installDate,
      installMileage: mi,
      gains: f.gains.trim().slice(0, 60),
      notes: f.notes.trim().slice(0, 1000),
      image,
    });
    toast.success(`${f.name} added to your build`);
    setF(empty);
    setImage(undefined);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Modification</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Part Name">
            <input required maxLength={80} value={f.name} onChange={set("name")} placeholder="Stage 2 ECU Remap" className="field" />
          </Field>
          <Field label="Category">
            <select value={f.category} onChange={set("category")} className="field">
              {MOD_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Install Date">
              <input type="date" required max={today()} value={f.installDate} onChange={set("installDate")} className="field" />
            </Field>
            <Field label="Install Mileage">
              <input inputMode="numeric" required value={f.installMileage} onChange={(e) => setF((s) => ({ ...s, installMileage: e.target.value.replace(/\D/g, "") }))} placeholder="87,420" className="field" />
            </Field>
          </div>
          <Field label="Horsepower / Torque Gains">
            <input maxLength={60} value={f.gains} onChange={set("gains")} placeholder="+50 bhp / +80 Nm" className="field" />
          </Field>
          <Field label="Dyno Graph / Spec Sheet">
            <ImagePicker value={image} onChange={setImage} label="Upload dyno sheet" />
          </Field>
          <Field label="Detailed Notes">
            <textarea rows={3} maxLength={1000} value={f.notes} onChange={set("notes")} placeholder="Supporting mods, fuel requirements, tuner…" className="field" />
          </Field>
          <button type="submit" className="btn-primary w-full">Add to Active Build</button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function RevertDialog({ mod, onClose }: { mod: Modification | null; onClose: () => void }) {
  const { revertMod } = useVault();
  const [date, setDate] = useState(today());
  const [mileage, setMileage] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const mi = parseInt(mileage, 10);
    if (!mod || !Number.isFinite(mi)) { return; }
    if (mi < mod.installMileage) { toast.error("Removal mileage can't be lower than install mileage."); return; }
    revertMod(mod.id, date, mi);
    toast.success(`${mod.name} moved to Diagnostic History`);
    setMileage("");
    onClose();
  }

  return (
    <Dialog open={!!mod} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revert to Stock</DialogTitle>
          <DialogDescription>
            {mod?.name} will be logged in Diagnostic History for future engine diagnostics.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Removal Date">
              <input type="date" required min={mod?.installDate} max={today()} value={date} onChange={(e) => setDate(e.target.value)} className="field" />
            </Field>
            <Field label="Removal Mileage">
              <input inputMode="numeric" required value={mileage} onChange={(e) => setMileage(e.target.value.replace(/\D/g, ""))} placeholder="87,420" className="field" />
            </Field>
          </div>
          <button type="submit" className="btn-primary w-full">
            <RotateCcw className="h-4 w-4" /> Confirm Revert
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

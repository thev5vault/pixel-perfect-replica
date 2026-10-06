import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, CalendarPlus, Check, Timer, Upload } from "lucide-react";

const ONE_TAP = ["Oil & filter", "Air filter", "Pollen filter", "Spark plugs", "Brake fluid", "Wiper blades", "Tyre check", "Health check"];
import { toast } from "sonner";
import { can, formatVrm, today, useVault } from "@/lib/vault-store";
import { FeatureLock } from "@/components/vault/FeatureLock";
import { Field, ImagePicker, PageHeader } from "@/components/vault/ui-bits";

export const Route = createFileRoute("/garage")({
  head: () => ({
    meta: [
      { title: "Garage Portal — 20-Second Service Upload | V5Vault" },
      { name: "description", content: "Independent garages and specialists can stamp a verified service record onto a customer's digital vehicle passport in 20 seconds." },
      { property: "og:title", content: "Garage Portal — V5Vault" },
      { property: "og:description", content: "Tier 3 verified workshop uploads in 20 seconds." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GaragePage,
});

function GaragePage() {
  const { role } = useVault();

  if (!can.garage(role)) return <FeatureLock feature="garage" />;

  return <GaragePortal />;
}

function GaragePortal() {
  const { addService } = useVault();
  const empty = { vrm: "", mileage: "", work: "", workshop: "" };
  const [f, setF] = useState(empty);
  const [image, setImage] = useState<string>();
  const [stamped, setStamped] = useState<string | null>(null);
  const [checks, setChecks] = useState<string[]>([]);
  const toggle = (c: string) => setChecks((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const mi = parseInt(f.mileage, 10);
    if (!f.vrm || !Number.isFinite(mi) || (!f.work.trim() && checks.length === 0) || !f.workshop.trim()) { toast.error("All fields are required."); return; }
    const typed = f.work.trim().slice(0, 1000).split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const lines = typed.length ? [...typed, ...checks] : ["Workshop service", ...checks];
    const ok = addService({
      vrm: f.vrm,
      date: today(),
      mileage: mi,
      category: "Servicing",
      description: (lines[0] ?? "").slice(0, 80),
      items: lines.slice(1),
      garage: f.workshop.trim().slice(0, 80),
      verified: true,
      tier3: true,
      image,
    });
    if (!ok) { toast.error(`No V5Vault passport found for ${formatVrm(f.vrm)}.`); return; }
    setStamped(formatVrm(f.vrm));
    toast.success("Record pushed to customer's timeline");
    setF(empty);
    setChecks([]);
    setImage(undefined);
  }

  return (
    <div>
      <PageHeader title="Garage Portal" subtitle="Tier 3: Specialist & Workshop Access (20-Second Upload)" />

      {stamped && (
        <div className="vault-card mb-5 flex animate-vault-open items-center gap-3 border-success/40 p-4">
          <BadgeCheck className="h-8 w-8 text-success" />
          <div>
            <p className="font-bold text-success">Tier 3: Verified Workshop</p>
            <p className="text-sm text-muted-foreground">Stamped and pushed to {stamped}'s timeline.</p>
          </div>
        </div>
      )}

      <div className="vault-card mb-5 flex items-center gap-3 p-4">
        <CalendarPlus className="h-6 w-6 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Direct Customer Booking: On</p>
          <p className="text-xs text-muted-foreground">Customers with your Verified Workshop stamp see a "Book with" button on their timeline.</p>
        </div>
      </div>

      <form onSubmit={submit} className="vault-card space-y-4 p-5">
        <div className="flex items-center gap-2 text-xs font-semibold text-primary">
          <Timer className="h-4 w-4" /> Fast Log
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Customer VRM">
            <input required value={f.vrm} onChange={(e) => setF((s) => ({ ...s, vrm: formatVrm(e.target.value).slice(0, 8) }))} placeholder="AB14 CDE" className="field font-plate uppercase tracking-wider" />
          </Field>
          <Field label="Odometer (mi)">
            <input required inputMode="numeric" value={f.mileage} onChange={(e) => setF((s) => ({ ...s, mileage: e.target.value.replace(/\D/g, "") }))} placeholder="87,420" className="field" />
          </Field>
        </div>
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">One-Tap Jobs</span>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {ONE_TAP.map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={checks.includes(c)}
                onClick={() => toggle(c)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-semibold transition-colors ${checks.includes(c) ? "border-primary bg-primary/15 text-primary" : "text-muted-foreground"}`}
              >
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checks.includes(c) ? "border-primary bg-primary text-primary-foreground" : ""}`}>
                  {checks.includes(c) && <Check className="h-3 w-3" />}
                </span>
                {c}
              </button>
            ))}
          </div>
        </div>
        <Field label="Additional Notes">
          <textarea rows={3} maxLength={1000} value={f.work} onChange={(e) => setF((s) => ({ ...s, work: e.target.value }))} placeholder={"Interim service\nOil & filter\nWiper blades"} className="field" />
        </Field>
        <Field label="Workshop Name">
          <input required maxLength={80} value={f.workshop} onChange={(e) => setF((s) => ({ ...s, workshop: e.target.value }))} placeholder="Apex Performance Ltd" className="field" />
        </Field>
        <Field label="Invoice / Receipt">
          <ImagePicker value={image} onChange={setImage} label="Upload invoice" />
        </Field>
        <button type="submit" className="btn-primary w-full py-4">
          <Upload className="h-5 w-5" /> Upload Service Record
        </button>
      </form>
    </div>
  );
}

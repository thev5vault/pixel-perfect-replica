import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Camera, CheckCircle2, Disc3, Gauge, Plus, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  SERVICE_CATEGORIES,
  fmtDate,
  fmtMiles,
  today,
  useVault,
  type ServiceCategory,
} from "@/lib/vault-store";
import { Field, ImagePicker, Pill, Plate } from "@/components/vault/ui-bits";
import { TimelineItem } from "@/components/vault/TimelineItem";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "My Vehicle — V5Vault Digital Vehicle Passport" },
      { name: "description", content: "Your car's health at a glance: servicing, brakes, MOT status and verified service history." },
      { property: "og:title", content: "My Vehicle — V5Vault" },
      { property: "og:description", content: "Traffic-light vehicle health and a verified UK service history in your pocket." },
    ],
  }),
  component: Dashboard,
});

function monthsBetween(a: Date, b: Date) {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function Dashboard() {
  const { vehicle, services } = useVault();
  const [open, setOpen] = useState(false);

  const history = useMemo(
    () => services.filter((s) => s.vrm === vehicle.vrm).sort((a, b) => b.date.localeCompare(a.date)),
    [services, vehicle.vrm],
  );
  const lastOf = (c: ServiceCategory) => history.find((s) => s.category === c);
  const lastService = lastOf("Servicing");
  const lastBrakes = lastOf("Brakes");
  const odometer = Math.max(vehicle.odometer, ...history.map((h) => h.mileage));
  const motMonths = monthsBetween(new Date(), new Date(vehicle.motExpiry));
  const serviceOk = lastService && monthsBetween(new Date(lastService.date), new Date()) < 24;

  return (
    <div className="space-y-6">
      <section className="vault-card relative overflow-hidden p-5">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div>
            <Plate vrm={vehicle.vrm} size="lg" />
            <h1 className="mt-3 text-2xl font-bold">
              {vehicle.make} {vehicle.model}
            </h1>
          </div>
          <Pill tone="primary">V5C · {fmtDate(vehicle.v5cDate)}</Pill>
        </div>
        <div className="relative mt-4 flex items-center gap-2 text-muted-foreground">
          <Gauge className="h-4 w-4 text-primary" />
          <span className="font-display text-xl font-bold text-foreground">{fmtMiles(odometer)}</span>
          <span className="text-xs">odometer</span>
        </div>
        <div className="relative mt-3 inline-flex items-center gap-2 rounded-full border border-success/40 bg-success/10 px-3 py-1 text-xs font-semibold text-success">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          DVLA Sync: Active (Last checked: Today)
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <HealthCard
          icon={<Wrench className="h-5 w-5" />}
          title="Servicing"
          ok={!!serviceOk}
          status={serviceOk ? "Up to Date" : "Service Overdue"}
          meta={lastService ? `Last done: ${fmtDate(lastService.date)}` : "No record"}
        />
        <HealthCard
          icon={<Disc3 className="h-5 w-5" />}
          title="Brakes"
          ok={!!lastBrakes}
          status={lastBrakes ? "Good Condition" : "Check Needed"}
          meta={lastBrakes ? `Checked: ${fmtDate(lastBrakes.date)}` : "No record"}
        />
        <HealthCard
          icon={<AlertTriangle className="h-5 w-5" />}
          title="MOT Status"
          ok={motMonths > 2}
          status={motMonths > 2 ? "MOT Valid" : "MOT Due Soon"}
          meta={`Expires ${new Date(vehicle.motExpiry).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}${motMonths >= 0 ? ` · ${motMonths} mo left` : ""}`}
          forceWarn
        />
      </section>

      <button onClick={() => setOpen(true)} className="btn-primary w-full py-4 text-base">
        <Plus className="h-5 w-5" /> Snap Receipt
      </button>

      <section>
        <h2 className="mb-3 text-lg font-bold">Service History</h2>
        <ol className="relative space-y-4 border-l border-primary/30 pl-5">
          {history.map((s) => (
            <TimelineItem key={s.id} s={s} />
          ))}
          {history.length === 0 && <p className="text-sm text-muted-foreground">No records yet. Snap your first receipt.</p>}
        </ol>
      </section>

      <SnapReceiptDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function HealthCard({
  icon,
  title,
  ok,
  status,
  meta,
  forceWarn,
}: {
  icon: React.ReactNode;
  title: string;
  ok: boolean;
  status: string;
  meta: string;
  forceWarn?: boolean;
}) {
  const warn = !ok || (forceWarn && status.includes("Soon"));
  return (
    <div className="vault-card flex items-center gap-3 p-4 sm:flex-col sm:items-start">
      <div className={warn ? "rounded-lg bg-warning/15 p-2 text-warning" : "rounded-lg bg-success/15 p-2 text-success"}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
        <Pill tone={warn ? "warning" : "success"} className="mt-1">
          {warn ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
          {status}
        </Pill>
        <p className="mt-1 text-xs text-muted-foreground">{meta}</p>
      </div>
    </div>
  );
}


function SnapReceiptDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { vehicle, addService } = useVault();
  const [form, setForm] = useState({ date: today(), mileage: "", category: "Servicing" as ServiceCategory, description: "", cost: "", garage: "" });
  const [image, setImage] = useState<string>();
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const mileage = parseInt(form.mileage, 10);
    const cost = parseFloat(form.cost);
    if (!form.description.trim() || !Number.isFinite(mileage) || mileage < 0 || mileage > 2_000_000) {
      { toast.error("Add a description and a valid mileage."); return; }
    }
    const lines = form.description.trim().slice(0, 1000).split(/\n+/).map((l) => l.trim()).filter(Boolean);
    addService({
      vrm: vehicle.vrm,
      date: form.date,
      mileage,
      category: form.category,
      description: (lines[0] ?? "").slice(0, 80),
      items: lines.slice(1),
      cost: Number.isFinite(cost) ? cost : undefined,
      garage: form.garage.trim().slice(0, 80) || "Self-logged",
      verified: false,
      image,
    });
    toast.success("Receipt added to your timeline");
    setForm({ date: today(), mileage: "", category: "Servicing", description: "", cost: "", garage: "" });
    setImage(undefined);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" /> Snap Receipt
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <input type="date" required max={today()} value={form.date} onChange={set("date")} className="field" />
            </Field>
            <Field label="Mileage">
              <input inputMode="numeric" required placeholder="87,420" value={form.mileage} onChange={(e) => setForm((f) => ({ ...f, mileage: e.target.value.replace(/\D/g, "") }))} className="field" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select value={form.category} onChange={set("category")} className="field">
                {SERVICE_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Cost (£)">
              <input inputMode="decimal" placeholder="0.00" value={form.cost} onChange={set("cost")} className="field" />
            </Field>
          </div>
          <Field label="Garage (optional)">
            <input maxLength={80} value={form.garage} onChange={set("garage")} placeholder="e.g. Kwik Fit Leeds" className="field" />
          </Field>
          <Field label="Work Description">
            <textarea rows={3} maxLength={1000} value={form.description} onChange={set("description")} placeholder={"Front tyres replaced\nMichelin Pilot Sport 4 x2"} className="field" />
          </Field>
          <Field label="Invoice / Receipt">
            <ImagePicker value={image} onChange={setImage} label="Take photo or upload" />
          </Field>
          <button type="submit" className="btn-primary w-full">Save to Timeline</button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

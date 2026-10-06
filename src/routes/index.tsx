import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Camera, CheckCircle2, Disc3, Gauge, Plus, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ModalHeader } from "@/components/vault/ModalHeader";
import {
  MOT_READINGS,
  SERVICE_CATEGORIES,
  can,
  fmtDate,
  fmtMiles,
  today,
  useVault,
  type ServiceCategory,
} from "@/lib/vault-store";
import { Field, ImagePicker, Pill, Plate } from "@/components/vault/ui-bits";
import { TimelineItem } from "@/components/vault/TimelineItem";
import { LockedField, UpgradeDialog } from "@/components/vault/UpgradeDialog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "My Vehicle — V5Vault Digital Vehicle Passport" },
      { name: "description", content: "Your car's health at a glance: servicing, brakes, MOT status and verified service history." },
      { property: "og:title", content: "My Vehicle — V5Vault" },
      { property: "og:description", content: "Traffic-light vehicle health and a verified UK service history in your pocket." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

function monthsBetween(a: Date, b: Date) {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

function Dashboard() {
  const { vehicle, services, role } = useVault();
  const [open, setOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const motReadings = vehicle.motHistory ?? MOT_READINGS;

  const history = useMemo(
    () => services.filter((s) => s.vrm === vehicle.vrm).sort((a, b) => b.date.localeCompare(a.date)),
    [services, vehicle.vrm],
  );
  const lastOf = (c: ServiceCategory) => history.find((s) => s.category === c);
  const lastService = lastOf("Servicing");
  const lastBrakes = lastOf("Brakes");
  const odometer = Math.max(vehicle.odometer, ...history.map((h) => h.mileage));
  const motMonths = vehicle.motExpiry ? monthsBetween(new Date(), new Date(vehicle.motExpiry)) : -1;
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
          <Pill tone="primary">V5C · {vehicle.v5cDate ? fmtDate(vehicle.v5cDate) : "Date unavailable"}</Pill>
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
          {vehicle.source === "official" ? "Official API data · last lookup saved" : "Sample vehicle · demo MOT history"}
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
          status={!vehicle.motExpiry ? vehicle.motStatus ?? "Unknown" : motMonths < 0 ? "MOT Expired" : motMonths > 2 ? "MOT Valid" : "MOT Due Soon"}
          meta={vehicle.motExpiry ? `Expires ${new Date(vehicle.motExpiry).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}${motMonths >= 0 ? ` · ${motMonths} mo left` : ""}` : "Expiry date unavailable"}
          forceWarn
        />
      </section>

      <button onClick={() => (can.diy(role) ? setOpen(true) : setUpgradeOpen(true))} className="btn-primary w-full py-4 text-base">
        <Plus className="h-5 w-5" /> Snap Receipt
      </button>

      <section>
        <h2 className="mb-3 text-lg font-bold">Service History</h2>
        <ol className="relative space-y-4 border-l border-primary/30 pl-5">
          {history.map((s) => (
            <TimelineItem key={s.id} s={s} bookable />
          ))}
          {history.length === 0 && <p className="text-sm text-muted-foreground">No records yet. Snap your first receipt.</p>}
        </ol>
      </section>

      <section className="vault-card p-4">
        <h2 className="flex items-center justify-between font-bold">
          MOT History <span className="text-xs font-semibold text-success">{vehicle.source === "official" ? "Official API lookup" : "Sample history"}</span>
        </h2>
        <ul className="mt-3 divide-y text-sm">
          {[...motReadings].reverse().map((m, i) => (
            <li key={`${m.date}-${i}`} className="flex flex-wrap justify-between gap-3 py-2">
              <span>{fmtDate(m.date)}</span>
              <span className="text-muted-foreground">{m.mileage !== undefined ? fmtMiles(m.mileage) : "Mileage unavailable"}</span>
              <span className={m.result === "Pass" ? "text-success" : "text-warning"}>{m.result}</span>
              {m.advisories?.length ? <ul className="w-full list-disc pl-4 text-xs text-muted-foreground">{m.advisories.map((a, j) => <li key={j}>{a}</li>)}</ul> : null}
            </li>
          ))}
        </ul>
        {!motReadings.length && <p className="mt-3 text-sm text-muted-foreground">No MOT history available.</p>}
      </section>

      <SnapReceiptDialog open={open && can.diy(role)} onOpenChange={setOpen} />
      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        description="Upgrade to Pro DIY (£0.99/mo) to upload receipts."
        perks={["Upload and keep high-resolution receipt photos"]}
      />
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
  const { vehicle, addService, role } = useVault();
  const pro = can.diy(role);
  const empty = { date: today(), mileage: "", category: "Servicing" as ServiceCategory, description: "", garage: "", parts: "", fluids: "", partsCost: "", labourCost: "" };
  const [form, setForm] = useState(empty);
  const [image, setImage] = useState<string>();
  const [upsell, setUpsell] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const money = (v: string) => {
    const n = parseFloat(v);
    return Number.isFinite(n) && n >= 0 && n < 1_000_000 ? Math.round(n * 100) / 100 : undefined;
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const mileage = parseInt(form.mileage, 10);
    if (!form.description.trim() || !form.garage.trim() || !Number.isFinite(mileage) || mileage < 0 || mileage > 2_000_000) {
      toast.error("Add a description, garage name and a valid mileage.");
      return;
    }
    const lines = form.description.trim().slice(0, 1000).split(/\n+/).map((l) => l.trim()).filter(Boolean);
    const partsCost = pro ? money(form.partsCost) : undefined;
    const labourCost = pro ? money(form.labourCost) : undefined;
    const parts = pro
      ? form.parts
          .split(/\n+/)
          .map((l) => l.split("|").map((x) => x.trim().slice(0, 60)))
          .filter(([n]) => n)
          .slice(0, 20)
          .map(([name, partNo]) => ({ name: name!, partNo: partNo ?? "" }))
      : undefined;
    addService({
      vrm: vehicle.vrm,
      date: form.date,
      mileage,
      category: form.category,
      description: (lines[0] ?? "").slice(0, 80),
      items: lines.slice(1),
      cost: partsCost != null || labourCost != null ? (partsCost ?? 0) + (labourCost ?? 0) : undefined,
      partsCost,
      labourCost,
      parts: parts?.length ? parts : undefined,
      fluids: pro ? form.fluids.trim().slice(0, 120) || undefined : undefined,
      garage: form.garage.trim().slice(0, 80),
      verified: false,
      image: pro ? image : undefined,
    });
    toast.success("Record added to your timeline");
    setForm(empty);
    setImage(undefined);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0">
        <ModalHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" /> Snap Receipt
          </DialogTitle>
          <DialogDescription>Add a dated service record and receipt to your vehicle.</DialogDescription>
        </ModalHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 pb-6">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date">
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild><button type="button" className="field text-left">{fmtDate(form.date)}</button></PopoverTrigger>
                <PopoverContent align="start" className="z-[100] w-auto rounded-xl border border-slate-700 bg-slate-900 p-3 shadow-2xl">
                  <Calendar mode="single" selected={new Date(`${form.date}T00:00:00`)} disabled={{ after: new Date() }}
                    className="bg-slate-900"
                    onSelect={(date) => {
                      if (!date) return;
                      const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
                      setForm((f) => ({ ...f, date: iso }));
                      setCalendarOpen(false);
                    }} />
                </PopoverContent>
              </Popover>
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
            <Field label="Garage Name">
              <input required maxLength={80} value={form.garage} onChange={set("garage")} placeholder="Kwik Fit Leeds" className="field" />
            </Field>
          </div>
          <Field label="Work Description">
            <textarea rows={2} maxLength={1000} value={form.description} onChange={set("description")} placeholder={"Front tyres replaced\nMichelin Pilot Sport 4 x2"} className="field" />
          </Field>

          {pro ? (
            <>
              <Field label="OEM Part Numbers (name | part no.)">
                <textarea rows={3} maxLength={1200} value={form.parts} onChange={set("parts")} placeholder={"Oil filter | Bosch F 026 407 183\nPollen filter | Febi Bilstein 26600"} className="field font-mono text-xs" />
              </Field>
              <Field label="Fluid Specs">
                <input maxLength={120} value={form.fluids} onChange={set("fluids")} placeholder="Castrol Edge 5W-30 LL, 4.6L" className="field" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Parts (£)">
                  <input inputMode="decimal" placeholder="0.00" value={form.partsCost} onChange={set("partsCost")} className="field" />
                </Field>
                <Field label="Labour (£)">
                  <input inputMode="decimal" placeholder="0.00" value={form.labourCost} onChange={set("labourCost")} className="field" />
                </Field>
              </div>
              <Field label="High-res Receipt">
                <ImagePicker value={image} onChange={setImage} label="Take photo or upload" />
              </Field>
            </>
          ) : (
            <div className="space-y-2">
              <LockedField label="OEM part numbers & fluid specs" onClick={() => setUpsell(true)} />
              <LockedField label="Parts vs labour cost (£)" onClick={() => setUpsell(true)} />
              <LockedField label="Receipt photo upload" onClick={() => setUpsell(true)} />
            </div>
          )}
          </div>
          <footer className="sticky bottom-0 z-20 flex-none border-t border-slate-800 bg-slate-900 p-4">
            <button type="submit" className="btn-primary w-full">Save to Timeline</button>
          </footer>
        </form>
        <UpgradeDialog open={upsell} onOpenChange={setUpsell} />
      </DialogContent>
    </Dialog>
  );
}

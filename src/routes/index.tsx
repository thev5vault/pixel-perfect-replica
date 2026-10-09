import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, Camera, CheckCircle2, Disc3, Gauge, Plus, ShieldCheck, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ModalHeader } from "@/components/vault/ModalHeader";
import { BasicDiyServiceDialog } from "@/components/vault/BasicDiyServiceDialog";
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
import { DocumentPrivacyNotice, ImagePicker, ModalField, ModalFieldGroup, MODAL_INPUT_CLASS, MODAL_SELECT_CLASS, MODAL_TEXTAREA_CLASS, Pill, Plate } from "@/components/vault/ui-bits";
import { TimelineItem } from "@/components/vault/TimelineItem";
import { LockedField, UpgradeDialog } from "@/components/vault/UpgradeDialog";
import { useAccount } from "@/lib/account-store";
import { VehicleLookupDialog } from "@/components/vault/VehicleLookupDialog";
import { V5VaultLogo } from "@/components/vault/V5VaultLogo";
import { DevPreviewButton } from "@/components/vault/DevPreviewButton";
import { VehicleDataTools } from "@/components/vault/VehicleDataTools";
import { PdfReceiptPicker } from "@/components/vault/PdfReceiptPicker";
import { parseInvoiceText, readInvoiceText } from "@/services/invoice-ocr";
import { UpdateVehicleRegistrationDialog } from "@/components/vault/UpdateVehicleRegistrationDialog";
import { hasVerifiedVehicleRegistration, REVERIFICATION_NOTICE } from "@/lib/vehicle-verification";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "V5Vault — The Vehicle History Passport" },
      { name: "description", content: "A vehicle history passport for UK owners, modders and independent workshops." },
      { property: "og:title", content: "V5Vault — The Vehicle History Passport" },
      { property: "og:description", content: "A portable record of vehicle history, maintenance and workshop stamps." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PublicLanding,
});

function monthsBetween(a: Date, b: Date) {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

export function Dashboard() {
  const { vehicle, services, role } = useVault();
  const account = useAccount();
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [diyOpen, setDiyOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [registrationOpen, setRegistrationOpen] = useState(false);
  const [verificationState, setVerificationState] = useState(vehicle.verification_state ?? "PENDING_VERIFICATION");
  useEffect(() => {
    setVerificationState(vehicle.verification_state ?? "PENDING_VERIFICATION");
  }, [vehicle.vin, vehicle.verification_state]);
  const registrationVerified = hasVerifiedVehicleRegistration(verificationState);
  const motReadings = vehicle.motHistory ?? (vehicle.source==="demo"?MOT_READINGS:[]);

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

  if (account?.signedIn && account.state && account.state.vehicles.length === 0) {
    return <section className="vault-card relative overflow-hidden p-6 sm:p-8">
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative">
        <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-primary">Your keeper record</p>
        <h1 className="mt-3 max-w-lg text-3xl font-bold">Your passport starts with a vehicle.</h1>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">Connect a vehicle with the reference printed on your V5C logbook. This links your account to its existing history; it does not trigger a live DVLA check.</p>
        <button type="button" onClick={() => setConnectOpen(true)} className="btn-primary mt-6"><Plus className="h-5 w-5" /> Connect New Vehicle</button>
      </div>
      <VehicleLookupDialog open={connectOpen} onOpenChange={setConnectOpen} />
    </section>;
  }

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
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {vehicle.status && <Pill tone={vehicle.status === "approved" ? "success" : vehicle.status === "pending" ? "warning" : "muted"}>{vehicle.is_sample ? "Development sample · " : ""}Keeper link {vehicle.status}</Pill>}
            <Pill tone={vehicle.verification_tier === "government_data" ? "success" : vehicle.verification_tier === "workshop_checked" ? "primary" : "muted"}>
              {vehicle.verification_tier === "government_data" ? "Government data matched" : vehicle.verification_tier === "workshop_checked" ? "Workshop checked" : "Provisional vehicle data"}
            </Pill>
            {vehicle.is_scrapped && <Pill tone="warning">Scrapped · read-only</Pill>}
            <Pill tone="primary">V5C · {vehicle.v5cDate ? fmtDate(vehicle.v5cDate) : "Date unavailable"}</Pill>
            {vehicle.registrationDate && <Pill tone="muted">First registered · {fmtDate(vehicle.registrationDate)}</Pill>}
          </div>
        </div>
        {vehicle.registrationDate && <p className="relative mt-2 text-xs text-muted-foreground">
          {vehicle.year ?? ""}{vehicle.year ? " · " : ""}{vehicle.colour ?? ""}{vehicle.colour ? " · " : ""}{vehicle.fuelType ?? ""}
        </p>}
        <div className="relative mt-4 flex items-center gap-2 text-muted-foreground">
          <Gauge className="h-4 w-4 text-primary" />
          <span className="font-display text-xl font-bold text-foreground">{vehicle.odometerAvailable === false && history.length === 0 ? "Not recorded" : fmtMiles(odometer)}</span>
          <span className="text-xs">odometer</span>
        </div>
        <div className="relative mt-3 inline-flex items-center gap-2 rounded-full border border-success/40 bg-success/10 px-3 py-1 text-xs font-semibold text-success">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
          </span>
          {vehicle.source === "official"
            ? "Official API data · last lookup saved"
            : vehicle.source === "user-provided"
              ? "Supplied specifications · not live verified"
              : "Sample vehicle · demo MOT history"}
        </div>
      </section>

      {!registrationVerified && <section role="status" className="rounded-xl border border-amber-400/30 bg-amber-950/20 p-4">
        <p className="font-semibold text-amber-100">Vehicle logbook verification required</p>
        <p className="mt-2 text-sm leading-relaxed text-amber-100/80">{REVERIFICATION_NOTICE}</p>
        {vehicle.is_sample
          ? <p className="mt-3 text-xs text-amber-100/70">This is development sample data and cannot be verified as a live vehicle.</p>
          : <button type="button" onClick={() => setRegistrationOpen(true)} disabled={!vehicle.vin} className="btn-ghost mt-3 min-h-11 w-full border-amber-200/20 text-amber-50 disabled:opacity-50">Update Logbook / Plate Details</button>}
      </section>}

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

      {vehicle.is_scrapped && <div role="status" className="rounded-xl border border-amber-400/30 bg-amber-950/25 p-4 text-sm text-amber-100">This vehicle is marked as scrapped. Its passport and history remain readable, but new service and modification records are blocked.</div>}
      <button disabled={vehicle.is_scrapped || vehicle.access==="archived"||vehicle.access==="plan_locked"} onClick={() => setReceiptOpen(true)} className="btn-primary w-full py-4 text-base">
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

      <VehicleDataTools/>
      <button className="btn-ghost w-full" onClick={()=>setDiyOpen(true)} disabled={vehicle.is_scrapped || vehicle.access==="archived"||vehicle.access==="plan_locked"}>Add a basic DIY service entry</button>
      {vehicle.access==="plan_locked"&&<p className="text-sm text-amber-300">Read-only vehicle · your current plan includes one active vehicle. Collector includes three.</p>}
      {vehicle.access==="archived"&&<p className="text-sm text-amber-300">Archived keeper history · read-only</p>}
      <SnapReceiptDialog open={receiptOpen} onOpenChange={setReceiptOpen} />
      <BasicDiyServiceDialog open={diyOpen} onOpenChange={setDiyOpen} />
      <UpdateVehicleRegistrationDialog
        open={registrationOpen}
        onOpenChange={setRegistrationOpen}
        vin={vehicle.vin ?? ""}
        currentVrm={vehicle.vrm}
        onSubmitted={(state, message) => {
          setVerificationState(state);
          toast.success("Re-verification submitted", { description: message });
        }}
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
  const quickWorkItems = ["Oil & filter", "Brakes", "Tyres", "Battery", "Coolant", "Inspection"];
  const invoiceComponents = ["Engine oil", "Oil filter", "Air filter", "Cabin filter", "Brake pads", "Brake discs", "Brake fluid", "Tyres", "Battery", "Coolant", "Suspension"];
  const empty = { date: today(), mileage: "", category: "Servicing" as ServiceCategory, description: "", garage: "", parts: "", fluids: "", partsCost: "", labourCost: "" };
  const [form, setForm] = useState(empty);
  const [image, setImage] = useState<string>();
  const [upsell, setUpsell] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pdfReceipt,setPdfReceipt]=useState<{name:string;data:string}|undefined>();
  const [readingPdf,setReadingPdf]=useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const [calendarOpen, setCalendarOpen] = useState(false);
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));
  const money = (v: string) => {
    const n = parseFloat(v);
    return Number.isFinite(n) && n >= 0 && n < 1_000_000 ? Math.round(n * 100) / 100 : undefined;
  };

  async function scanAttachedInvoice(uploadedDocument?: string) {
    const document = uploadedDocument ?? pdfReceipt?.data ?? image;
    if (!pro || !document || scanBusy) return;
    setScanBusy(true);
    setScanMessage("Preparing local invoice scan…");
    try {
      const blob = await (await fetch(document)).blob();
      const { text, pagesScanned, totalPages } = await readInvoiceText(blob, setScanMessage);
      const suggestions = parseInvoiceText(text, SERVICE_CATEGORIES, invoiceComponents);
      const suggestionCount = Object.keys(suggestions).filter((key) => key !== "components" || suggestions.components?.length).length;
      if (!suggestionCount) {
        setScanMessage("Local OCR could not confidently identify editable fields. Your document is still attached; enter the details manually.");
        return;
      }
      setForm((current) => {
        const next = { ...current };
        if (suggestions.mileage && !current.mileage.trim()) next.mileage = suggestions.mileage;
        if (suggestions.date && (!current.date || current.date === today())) next.date = suggestions.date;
        if (suggestions.category && current.category === "Servicing" &&
            SERVICE_CATEGORIES.includes(suggestions.category as ServiceCategory)) {
          next.category = suggestions.category as ServiceCategory;
        }
        if (!current.description.trim()) {
          next.description = (suggestions.notes || suggestions.components?.join("\n") || "").slice(0, 1000);
        }
        if (suggestions.partsCost && !current.partsCost.trim()) next.partsCost = suggestions.partsCost;
        if (suggestions.labourCost && !current.labourCost.trim()) next.labourCost = suggestions.labourCost;
        if (suggestions.components?.length && !current.parts.trim()) {
          next.parts = suggestions.components.map((component) => `${component} |`).join("\n");
        }
        return next;
      });
      const pageNote = totalPages > pagesScanned ? ` Scanned the first ${pagesScanned} of ${totalPages} pages.` : "";
      setScanMessage(`Local OCR suggested ${suggestionCount} field${suggestionCount === 1 ? "" : "s"}. Review and edit the values before saving; the document stayed in this browser.${pageNote}`);
    } catch (error) {
      setScanMessage(`${error instanceof Error ? error.message : "Local OCR could not read this file."} The document remains attached; enter the details manually.`);
    } finally {
      setScanBusy(false);
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (vehicle.is_scrapped) {
      toast.error("This scrapped vehicle passport is read-only.");
      return;
    }
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
    void save();
    async function save() {
    setSaving(true);
    try {
    const result = await addService({
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
      is_verified_stamp: false,
      image,
      invoice_name:pdfReceipt?.name,invoice_data:pdfReceipt?.data,
    });
    if (result === false) throw new Error("A linked vehicle was not found for this record.");
    toast.success("Record added to your timeline");
    setForm(empty);
    setImage(undefined);
    setPdfReceipt(undefined);
    onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Record could not be saved");
    } finally { setSaving(false); }
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="flex max-h-[var(--dialog-max-height,90dvh)] flex-col gap-4 overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950 p-5 shadow-2xl">
        <ModalHeader className="border-0 bg-transparent px-0 py-0">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" /> Snap Receipt
          </DialogTitle>
          <DialogDescription>Upload a receipt first. Pro DIY runs on-device OCR automatically; every suggested value remains editable before saving.</DialogDescription>
        </ModalHeader>
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain scroll-p-1 p-1">
          <DocumentPrivacyNotice />
          <ModalFieldGroup label="Receipt photo · available on every plan">
            <ImagePicker value={image} onChange={(value) => {
              setImage(value);
              if (value && pro) void scanAttachedInvoice(value);
            }} label="Take photo or upload" />
          </ModalFieldGroup>
          <ModalFieldGroup label="Invoice PDF · available on every plan">
            <PdfReceiptPicker onChange={(file) => {
              setPdfReceipt(file);
              if (file?.data && pro) void scanAttachedInvoice(file.data);
            }} onReadingChange={setReadingPdf}/>
          </ModalFieldGroup>
          {pro && (pdfReceipt || image) && <button type="button" onClick={() => void scanAttachedInvoice()} disabled={scanBusy || readingPdf} className="btn-secondary min-h-11 w-full">
            {scanBusy ? "Scanning on this device…" : "Scan invoice again on this device"}
          </button>}
          {scanMessage && <p role="status" className="rounded-lg border border-amber-400/30 bg-amber-950/20 p-3 text-sm text-amber-100">{scanMessage}</p>}
          <div className="grid w-full min-w-0 grid-cols-2 gap-3">
            <ModalField label="Date">{(id, labelId) => (
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild><button id={id} aria-labelledby={labelId} type="button" className={`${MODAL_INPUT_CLASS} text-left`}>{fmtDate(form.date)}</button></PopoverTrigger>
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
            )}</ModalField>
            <ModalField label="Mileage">{(id) => (
              <input id={id} inputMode="numeric" required placeholder="87,420" value={form.mileage} onChange={(e) => setForm((f) => ({ ...f, mileage: e.target.value.replace(/\D/g, "") }))} className={MODAL_INPUT_CLASS} />
            )}</ModalField>
          </div>
          <div className="grid w-full min-w-0 grid-cols-2 gap-3">
            <ModalField label="Category" select>{(id) => (
              <select id={id} value={form.category} onChange={set("category")} className={MODAL_SELECT_CLASS}>
                {SERVICE_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            )}</ModalField>
            <ModalField label="Garage Name">{(id) => (
              <input id={id} required maxLength={80} value={form.garage} onChange={set("garage")} placeholder="Kwik Fit Leeds" className={MODAL_INPUT_CLASS} />
            )}</ModalField>
          </div>
          <ModalField label="Work Description">{(id) => (
            <textarea id={id} rows={2} maxLength={1000} value={form.description} onChange={set("description")} placeholder={"Front tyres replaced\nMichelin Pilot Sport 4 x2"} className={MODAL_TEXTAREA_CLASS} />
          )}</ModalField>
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Quick add work items</p>
            <div className="flex flex-wrap gap-2">
              {quickWorkItems.map((item) => {
                const selected = form.description.split(/\n+/).some((line) => line.trim().toLowerCase() === item.toLowerCase());
                return <button key={item} type="button" aria-pressed={selected} onClick={() => setForm((current) => {
                  const lines = current.description.split(/\n+/).map((line) => line.trim()).filter(Boolean);
                  const existing = lines.findIndex((line) => line.toLowerCase() === item.toLowerCase());
                  if (existing >= 0) lines.splice(existing, 1);
                  else lines.push(item);
                  return { ...current, description: lines.join("\n").slice(0, 1000) };
                })} className={`min-h-10 rounded-full border px-3 text-xs font-medium transition-colors ${selected ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-300" : "border-slate-700 text-slate-300 hover:border-slate-500"}`}>
                  {item}
                </button>;
              })}
            </div>
          </div>

          {pro ? (
            <>
              <ModalField label="OEM Part Numbers (name | part no.)">{(id) => (
                <textarea id={id} rows={3} maxLength={1200} value={form.parts} onChange={set("parts")} placeholder={"Oil filter | Bosch F 026 407 183\nPollen filter | Febi Bilstein 26600"} className={MODAL_TEXTAREA_CLASS} />
              )}</ModalField>
              <ModalField label="Fluid Specs">{(id) => (
                <input id={id} maxLength={120} value={form.fluids} onChange={set("fluids")} placeholder="Castrol Edge 5W-30 LL, 4.6L" className={MODAL_INPUT_CLASS} />
              )}</ModalField>
              <div className="grid w-full min-w-0 grid-cols-2 gap-3">
                <ModalField label="Parts (£)">{(id) => (
                  <input id={id} inputMode="decimal" placeholder="0.00" value={form.partsCost} onChange={set("partsCost")} className={MODAL_INPUT_CLASS} />
                )}</ModalField>
                <ModalField label="Labour (£)">{(id) => (
                  <input id={id} inputMode="decimal" placeholder="0.00" value={form.labourCost} onChange={set("labourCost")} className={MODAL_INPUT_CLASS} />
                )}</ModalField>
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <LockedField label="OEM part numbers & fluid specs" onClick={() => setUpsell(true)} />
              <LockedField label="Parts vs labour cost (£)" onClick={() => setUpsell(true)} />
            </div>
          )}
          </div>
          <footer className="sticky bottom-0 z-20 flex-none bg-slate-950 pt-2">
            <button type="submit" disabled={saving||readingPdf} className="btn-primary w-full">{readingPdf?"Reading PDF…":saving ? "Saving record…" : "Save to Timeline"}</button>
          </footer>
        </form>
        <UpgradeDialog nested open={upsell} onOpenChange={setUpsell} />
      </DialogContent>
    </Dialog>
  );
}

function PublicLanding() {
  return (
    <main className="min-h-[100dvh] overflow-hidden bg-slate-950 text-slate-100">
      {import.meta.env.DEV && <div className="mx-auto max-w-md px-5"><DevPreviewButton /></div>}
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-5 sm:px-8">
        <div className="flex items-center gap-3"><V5VaultLogo className="h-10 w-10" /><span className="font-display text-lg font-extrabold">V5Vault</span></div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2"><a href="/sign-in" className="shrink-0 whitespace-nowrap rounded-full px-2 py-2 text-xs text-slate-300 hover:bg-slate-800 sm:px-4 sm:text-sm">Sign in</a><a href="/sign-up" className="btn-primary shrink-0 whitespace-nowrap px-2 py-2 text-xs sm:px-4 sm:text-sm">Create account</a></div>
      </header>
      <section className="relative mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-14 sm:px-8 sm:pb-28 sm:pt-24 md:grid-cols-[1.1fr_.9fr] md:items-center">
        <div className="absolute -left-40 top-24 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="relative"><p className="font-mono text-[11px] uppercase tracking-[.24em] text-cyan-300">The vehicle history passport</p><h1 className="mt-5 max-w-3xl font-display text-5xl font-extrabold leading-[1.02] tracking-[-.055em] sm:text-7xl">Every mile has a <span className="text-cyan-300">record.</span></h1><p className="mt-6 max-w-xl text-base leading-7 text-slate-300 sm:text-lg">A useful, portable history for the people who know a car best: its keeper, the hands-on builder, and the independent workshop.</p><div className="mt-8 flex flex-wrap gap-3"><a href="/sign-up" className="btn-primary px-6 py-3">Start a vehicle passport</a><a href="/sign-in" className="btn-ghost px-6 py-3">Sign in to your account</a></div><p className="mt-4 text-xs text-slate-500">Connect your vehicle using the 11-digit reference on its V5C logbook. Sample approvals are clearly labelled.</p></div>
        <div className="relative mx-auto w-full max-w-md"><div className="absolute inset-5 rounded-full bg-cyan-400/10 blur-3xl" /><div className="vault-card relative rotate-1 border-cyan-400/20 p-5 sm:p-7"><div className="flex items-center justify-between border-b border-slate-700 pb-4"><span className="font-mono text-[10px] uppercase tracking-[.2em] text-slate-400">Vehicle passport · preview</span><span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-300">Keeper linked</span></div><div className="mt-6 rounded-md border-2 border-slate-950 bg-[#facc15] px-4 py-2 text-center font-plate text-3xl tracking-widest text-slate-950">AB14 CDE</div><h2 className="mt-5 text-2xl font-bold">Your car. Its whole story.</h2><p className="mt-1 text-sm text-slate-400">A record that travels with the vehicle history.</p><div className="mt-6 space-y-3"><div className="flex gap-3 rounded-xl border border-slate-700/70 bg-slate-950/50 p-3"><span className="mt-1 h-2 w-2 rounded-full bg-cyan-300" /><div><p className="text-sm font-semibold">Workshop stamp · Service</p><p className="mt-1 text-xs text-slate-400">Signed record · mileage and date retained</p></div></div><div className="flex gap-3 rounded-xl border border-slate-700/70 bg-slate-950/50 p-3"><span className="mt-1 h-2 w-2 rounded-full bg-slate-400" /><div><p className="text-sm font-semibold">Owner record · Brake fluid</p><p className="mt-1 text-xs text-slate-400">Your own maintenance notes, clearly identified</p></div></div></div><div className="mt-5 flex justify-between border-t border-slate-700 pt-4 font-mono text-[10px] uppercase tracking-widest text-slate-500"><span>History with provenance</span><span>01 / 04</span></div></div></div>
      </section>
      <section className="border-y border-slate-800 bg-slate-900/45"><div className="mx-auto grid max-w-6xl gap-8 px-5 py-12 sm:px-8 md:grid-cols-3"><div><p className="font-mono text-xs text-cyan-300">01 / KEEP</p><h2 className="mt-3 text-xl font-bold">Link with your logbook</h2><p className="mt-2 text-sm leading-6 text-slate-400">Connect a registration and V5C reference. Sample claims are development-only; no live DVLA verification is implied.</p></div><div><p className="font-mono text-xs text-cyan-300">02 / RECORD</p><h2 className="mt-3 text-xl font-bold">Show who did the work</h2><p className="mt-2 text-sm leading-6 text-slate-400">Workshop-signed records stay distinct from owner-entered DIY notes.</p></div><div><p className="font-mono text-xs text-cyan-300">03 / SHARE</p><h2 className="mt-3 text-xl font-bold">Take the history with you</h2><p className="mt-2 text-sm leading-6 text-slate-400">Build a practical passport for a sale, a new workshop, or a long-term project car.</p></div></div></section>
      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 md:grid-cols-[.8fr_1.2fr] md:items-center"><div><p className="font-mono text-xs uppercase tracking-[.2em] text-cyan-300">One vehicle, a better handover</p><h2 className="mt-4 text-3xl font-bold leading-tight sm:text-4xl">Made for more than the day it changes hands.</h2></div><div className="grid gap-3 sm:grid-cols-2"><article className="vault-card p-5"><Gauge className="h-5 w-5 text-cyan-300" /><h3 className="mt-4 font-bold">For owners</h3><p className="mt-2 text-sm leading-6 text-slate-400">See service chronology, MOT data and your maintenance record in one place.</p></article><article className="vault-card p-5"><Wrench className="h-5 w-5 text-cyan-300" /><h3 className="mt-4 font-bold">For builders</h3><p className="mt-2 text-sm leading-6 text-slate-400">Keep an ordered modification story with provenance where available.</p></article><article className="vault-card p-5 sm:col-span-2"><ShieldCheck className="h-5 w-5 text-emerald-300" /><h3 className="mt-4 font-bold">For independent workshops</h3><p className="mt-2 text-sm leading-6 text-slate-400">Fast-log jobs to linked passports. Live VAT verification is only stated when server-verified; development samples never imply it.</p></article></div></section>
      <section className="mx-auto max-w-6xl px-5 pb-16 sm:px-8"><div className="rounded-3xl border border-cyan-400/20 bg-slate-900 p-7 sm:p-10"><p className="font-mono text-xs uppercase tracking-[.2em] text-cyan-300">Start with the logbook</p><h2 className="mt-3 text-3xl font-bold">Build a history worth keeping.</h2><p className="mt-2 max-w-xl text-sm text-slate-400">Your vehicle links and records stay attached to your account—not a sample vehicle on a shared device.</p><a href="/sign-up" className="btn-primary mt-5 px-6 py-3">Create your account</a></div></section>
      <footer className="border-t border-slate-800 px-5 py-6 text-center text-xs text-slate-500">V5Vault · UK vehicle history passport · Development sample data is not live V5C verification.</footer>
    </main>
  );
}

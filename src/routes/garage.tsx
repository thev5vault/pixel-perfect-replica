import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { BadgeCheck, Camera, Check, FileText, LoaderCircle, Search, ShieldCheck, Timer, Upload } from "lucide-react";
import { toast } from "sonner";
import { DocumentPrivacyNotice, Field, PageHeader, Pill } from "@/components/vault/ui-bits";
import { WorkshopReminders } from "@/components/vault/WorkshopReminders";
import { formatVrm, readImage, today } from "@/lib/vault-store";
import {
  clearGarageDraft,
  enqueueGarageSubmission,
  readGarageDraft,
  readGarageOutbox,
  removeGarageSubmission,
  saveGarageDraft,
} from "@/lib/garage-draft";
import { validateVIN } from "@/lib/vin";
import { useAccount } from "@/lib/account-store";
import { canUseWorkshopFeatures } from "@/lib/plans";
import { parseInvoiceText, readInvoiceText } from "@/services/invoice-ocr";

const CATEGORIES = ["Servicing", "Brakes", "Repairs", "Tyres"] as const;
const COMPONENTS = [
  "Engine oil", "Oil filter", "Air filter", "Cabin filter", "Spark plugs",
  "Brake pads", "Brake discs", "Brake fluid", "Tyres", "Battery", "Coolant", "Suspension",
];

type Category = (typeof CATEGORIES)[number];
type GarageStampPayload = {
  client_submission_id: string;
  vrm: string;
  vin: string;
  physically_inspected_vin: true;
  mileage: number;
  date: string;
  category: Category;
  components: string[];
  notes: string;
  advisories: string[];
  partsCost?: number;
  labourCost?: number;
  cost?: number;
  image?: string;
  invoice_name?: string;
  invoice_data?: string;
};

type GarageForm = {
  vrm: string;
  vin: string;
  physicalVinInspected: boolean;
  mileage: string;
  date: string;
  category: Category;
  components: string[];
  notes: string;
  advisories: string;
  partsCost: string;
  labourCost: string;
  receipt?: string;
  invoiceName?: string;
  invoiceData?: string;
};

function emptyForm(): GarageForm {
  return { vrm: "", vin: "", physicalVinInspected: false, mileage: "", date: today(), category: "Servicing", components: [], notes: "", advisories: "", partsCost: "", labourCost: "" };
}

function hasDraftContent(form: GarageForm) {
  return Boolean(form.vrm.trim() || form.vin.trim() || form.physicalVinInspected || form.mileage || form.components.length ||
    form.notes.trim() || form.advisories.trim() || form.partsCost || form.labourCost ||
    form.receipt || form.invoiceData);
}

function createSubmissionId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const Route = createFileRoute("/garage")({ component: GaragePage });

function GaragePage() {
  const account = useAccount();
  const user = account?.state?.user;
  const accountRefreshRef = useRef(account?.refresh);
  const syncingOutboxRef = useRef(false);
  const canStamp = user?.role === "dev_admin" || Boolean(user && canUseWorkshopFeatures(user));
  const canScanInvoice = Boolean(user && (user.subscription_tier !== "free" || user.workshop_access_active));
  const draftKey = user ? `garage-service:${user.id}` : null;
  const [form, setForm] = useState<GarageForm>(emptyForm);
  const [readyDraftKey, setReadyDraftKey] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState("");
  const [lookupDetails, setLookupDetails] = useState("");
  const [lookupSource, setLookupSource] = useState<"official" | "unverified" | null>(null);
  const [lookupBusy, setLookupBusy] = useState(false);
  const [fileBusy, setFileBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [queuedCount, setQueuedCount] = useState(0);
  const [queueStatus, setQueueStatus] = useState("");

  useEffect(() => {
    accountRefreshRef.current = account?.refresh;
  }, [account?.refresh]);

  useEffect(() => {
    if (!draftKey) {
      setReadyDraftKey(null);
      return;
    }
    let active = true;
    setForm(emptyForm());
    setReadyDraftKey(null);
    setDraftStatus("");
    void readGarageDraft<GarageForm>(draftKey).then((draft) => {
      if (!active) return;
      if (draft?.value && hasDraftContent(draft.value)) {
        setForm({ ...emptyForm(), ...draft.value });
        setDraftStatus(`Saved on this device ${new Date(draft.savedAt).toLocaleString("en-GB")} · not server-signed.`);
      }
      setReadyDraftKey(draftKey);
    }).catch(() => {
      if (active) {
        setDraftStatus("Local draft storage is unavailable in this browser.");
        setReadyDraftKey(draftKey);
      }
    });
    return () => { active = false; };
  }, [draftKey]);

  useEffect(() => {
    if (!user || !canStamp) {
      setQueuedCount(0);
      setQueueStatus("");
      return;
    }
    let active = true;
    const syncOutbox = async () => {
      if (syncingOutboxRef.current) return;
      syncingOutboxRef.current = true;
      try {
        const pending = await readGarageOutbox<GarageStampPayload>(user.id);
        if (!active) return;
        setQueuedCount(pending.length);
        if (!pending.length) {
          setQueueStatus("");
          return;
        }
        if (!navigator.onLine) {
          setQueueStatus(`${pending.length} service ${pending.length === 1 ? "record is" : "records are"} queued on this device · not server-signed yet.`);
          return;
        }

        setQueueStatus(`Syncing ${pending.length} offline ${pending.length === 1 ? "record" : "records"}…`);
        let synced = 0;
        let blockedMessage = "";
        for (const entry of pending) {
          if (!active || !navigator.onLine) break;
          const response = await fetch("/api/garage/stamp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(entry.payload),
          });
          const result = await response.json().catch(() => ({})) as { error?: string };
          if (!response.ok) {
            blockedMessage = `An offline record remains saved on this device. Sync stopped: ${result.error ?? "the server rejected the record."}`;
            break;
          }
          await removeGarageSubmission(entry.id);
          synced += 1;
        }

        const remaining = await readGarageOutbox<GarageStampPayload>(user.id);
        if (!active) return;
        setQueuedCount(remaining.length);
        if (synced) {
          setQueueStatus(remaining.length
            ? `${synced} offline ${synced === 1 ? "record synced" : "records synced"} · ${remaining.length} still queued.`
            : `${synced} offline ${synced === 1 ? "record synced" : "records synced"} to the vehicle passport.`);
          toast.success(synced === 1 ? "Offline service record synced." : `${synced} offline service records synced.`);
          void accountRefreshRef.current?.().catch(() => undefined);
        } else if (blockedMessage) {
          setQueueStatus(blockedMessage);
        } else if (remaining.length) {
          setQueueStatus(`${remaining.length} service ${remaining.length === 1 ? "record is" : "records are"} queued on this device · waiting to sync.`);
        } else {
          setQueueStatus("");
        }
      } catch {
        if (active) setQueueStatus("Offline records remain stored on this device. They will retry when the connection is available.");
      } finally {
        syncingOutboxRef.current = false;
      }
    };
    const retryWhenVisible = () => {
      if (document.visibilityState === "visible") void syncOutbox();
    };
    window.addEventListener("online", syncOutbox);
    window.addEventListener("focus", syncOutbox);
    document.addEventListener("visibilitychange", retryWhenVisible);
    void syncOutbox();
    return () => {
      active = false;
      window.removeEventListener("online", syncOutbox);
      window.removeEventListener("focus", syncOutbox);
      document.removeEventListener("visibilitychange", retryWhenVisible);
    };
  }, [user?.id, canStamp]);

  useEffect(() => {
    if (!draftKey || readyDraftKey !== draftKey) return;
    const key = draftKey;
    const timer = window.setTimeout(() => {
      if (!hasDraftContent(form)) {
        void clearGarageDraft(key).catch(() => undefined);
        return;
      }
      setDraftStatus("Saving this draft on this device…");
      void saveGarageDraft(key, form)
        .then(() => setDraftStatus("Saved locally · not server-signed"))
        .catch(() => setDraftStatus("Draft could not be saved locally. Keep this page open."));
    }, 450);
    return () => window.clearTimeout(timer);
  }, [draftKey, readyDraftKey, form]);

  function change<K extends keyof GarageForm>(key: K, value: GarageForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function lookupVehicle() {
    if (lookupBusy || !form.vrm.trim()) return;
    setLookupBusy(true);
    setError("");
    setLookupDetails("");
    try {
      const response = await fetch("/api/garage/lookup", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vrm: form.vrm }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Vehicle lookup failed.");
      const vehicle = payload.vehicle;
      setForm((current) => ({
        ...current,
        vrm: vehicle.vrm,
        vin: vehicle.vin ?? current.vin,
        mileage: vehicle.odometerAvailable === false ? current.mileage : String(vehicle.odometer ?? current.mileage),
      }));
      const detail = [
        vehicle.year,
        vehicle.make,
        vehicle.model,
        vehicle.colour,
        vehicle.fuelType,
        vehicle.motExpiry ? `MOT expiry ${vehicle.motExpiry}` : undefined,
      ].filter(Boolean).join(" · ");
      setLookupDetails(`${detail || vehicle.vrm}. ${payload.notice ?? ""}`.trim());
      setLookupSource(vehicle.source === "official" ? "official" : "unverified");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Vehicle lookup failed.");
    } finally {
      setLookupBusy(false);
    }
  }

  function toggleComponent(component: string) {
    setForm((current) => ({
      ...current,
      components: current.components.includes(component)
        ? current.components.filter((item) => item !== component)
        : [...current.components, component],
    }));
  }

  async function attachReceipt(file?: File) {
    setScanMessage("");
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) {
      setError("Choose a receipt image no larger than 8 MB.");
      return;
    }
    setFileBusy(true);
    setError("");
    try {
      const receipt = await readImage(file);
      if (receipt.length > 4_000_000) throw new Error("The resized receipt image is too large. Choose a smaller photo.");
      change("receipt", receipt);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Receipt image could not be read.");
    } finally {
      setFileBusy(false);
    }
  }

  async function attachInvoice(file?: File) {
    setScanMessage("");
    if (!file) return;
    if (file.type !== "application/pdf" || file.size > 5 * 1024 * 1024) {
      setError("Choose a PDF invoice no larger than 5 MB.");
      return;
    }
    setFileBusy(true);
    setError("");
    try {
      const invoiceData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Invoice could not be read."));
        reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Invoice could not be read."));
        reader.readAsDataURL(file);
      });
      if (invoiceData.length > 7_000_000) throw new Error("The invoice PDF is too large.");
      setForm((current) => ({ ...current, invoiceName: file.name.slice(0, 150), invoiceData }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Invoice could not be read.");
    } finally {
      setFileBusy(false);
    }
  }

  async function scanInvoice() {
    const document = form.invoiceData || form.receipt;
    if (!canScanInvoice || !document || scanBusy) return;
    setScanBusy(true);
    setScanMessage("Preparing local invoice scan…");
    try {
      const blob = await (await fetch(document)).blob();
      const { text, pagesScanned, totalPages } = await readInvoiceText(blob, setScanMessage);
      const suggestions = parseInvoiceText(text, CATEGORIES, COMPONENTS);
      const suggestionCount = Object.keys(suggestions).filter((key) => key !== "components" || suggestions.components?.length).length;
      if (!suggestionCount) {
        setScanMessage("Local OCR could not confidently identify editable fields. Your file is still attached; enter the details manually.");
        return;
      }
      setForm((current) => {
        const next = { ...current };
        if (suggestions.mileage && !current.mileage.trim()) next.mileage = suggestions.mileage;
        if (suggestions.date && (!current.date || current.date === today())) next.date = suggestions.date;
        if (suggestions.category && current.category === "Servicing") next.category = suggestions.category as Category;
        if (suggestions.notes && !current.notes.trim()) next.notes = suggestions.notes;
        if (suggestions.partsCost && !current.partsCost.trim()) next.partsCost = suggestions.partsCost;
        if (suggestions.labourCost && !current.labourCost.trim()) next.labourCost = suggestions.labourCost;
        if (suggestions.components?.length) {
          next.components = [...new Set([...current.components, ...suggestions.components])];
        }
        return next;
      });
      const pageNote = totalPages > pagesScanned ? ` Scanned the first ${pagesScanned} of ${totalPages} pages.` : "";
      setScanMessage(`Local OCR suggested ${suggestionCount} field${suggestionCount === 1 ? "" : "s"}. Check and edit every value before saving; the document was processed in this browser.${pageNote}`);
    } catch (cause) {
      setScanMessage(`${cause instanceof Error ? cause.message : "Local OCR could not read this file."} The document remains attached; enter the fields manually.`);
    } finally {
      setScanBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || fileBusy || !user || !canStamp) return;
    setError("");
    setSuccess("");
    const registration = form.vrm.toUpperCase().replace(/[^A-Z0-9]/g, "");
    const mileage = Number(form.mileage);
    if (!registration || !Number.isInteger(mileage) || mileage < 0 || mileage > 2_000_000) {
      setError("Enter a valid registration and odometer reading.");
      return;
    }
    if (!validateVIN(form.vin)) {
      setError("Enter a valid 17-character VIN. VINs do not contain I, O or Q.");
      return;
    }
    if (!form.physicalVinInspected) {
      setError("Confirm that you physically inspected and matched the VIN on the vehicle.");
      return;
    }
    if (!form.components.length && !form.notes.trim()) {
      setError("Select at least one component or describe the work performed.");
      return;
    }
    const draft = { ...form, vrm: registration };
    if (draftKey) {
      try { await saveGarageDraft(draftKey, draft); }
      catch { setDraftStatus("Could not save this draft locally. Keep this page open while submitting."); }
    }
    const partsCost = form.partsCost ? Number(form.partsCost) : undefined;
    const labourCost = form.labourCost ? Number(form.labourCost) : undefined;
    const totalCost = (partsCost ?? 0) + (labourCost ?? 0);
    const payload: GarageStampPayload = {
      client_submission_id: createSubmissionId(),
      vrm: registration,
      vin: form.vin.trim().toUpperCase(),
      physically_inspected_vin: true,
      mileage,
      date: form.date || today(),
      category: form.category,
      components: form.components,
      notes: form.notes.trim(),
      advisories: form.advisories.split(/\n+/).map((line) => line.trim()).filter(Boolean),
      ...(partsCost !== undefined ? { partsCost } : {}),
      ...(labourCost !== undefined ? { labourCost } : {}),
      ...(form.partsCost || form.labourCost ? { cost: totalCost } : {}),
      ...(form.receipt ? { image: form.receipt } : {}),
      ...(form.invoiceData ? { invoice_data: form.invoiceData, invoice_name: form.invoiceName } : {}),
    };
    const queueForSync = async () => {
      if (!user) throw new Error("Sign in with the workshop account that created this record before queuing it.");
      await enqueueGarageSubmission({ id: payload.client_submission_id, userId: user.id, payload });
      if (draftKey) await clearGarageDraft(draftKey).catch(() => undefined);
      setForm(emptyForm());
      setDraftStatus("");
      setQueuedCount((count) => count + 1);
      setQueueStatus("Service record saved offline · it is not server-signed and will sync when your connection returns.");
      toast.info("Saved offline. This service record will sync when you reconnect.");
      if (navigator.onLine) window.dispatchEvent(new Event("online"));
    };
    if (!navigator.onLine) {
      try {
        await queueForSync();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "The offline record could not be queued.");
        setDraftStatus("Your editable draft remains saved on this device. No server stamp has been created.");
      }
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/garage/stamp", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "The workshop record could not be saved.");
      if (draftKey) await clearGarageDraft(draftKey).catch(() => undefined);
      setForm(emptyForm());
      setDraftStatus("");
      setQueueStatus("");
      setSuccess(`Server-signed service record saved for ${formatVrm(registration)}. The VIN check and stamp status are recorded by the server.`);
      toast.success("VIN-linked service record added to the vehicle passport.");
      void account.refresh().catch(() => undefined);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "The workshop record could not be saved.";
      if (cause instanceof TypeError || !navigator.onLine) {
        try {
          await queueForSync();
        } catch (queueError) {
          setError(`${message} ${queueError instanceof Error ? queueError.message : "Offline storage is unavailable."}`);
          setDraftStatus("Your editable draft remains saved on this device. No server stamp has been created.");
        }
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  }

  return <div className="space-y-5">
    <PageHeader icon={<Timer className="h-5 w-5 text-primary" />} title="Workshop terminal" subtitle="VIN-checked workshop service history and supporting documents." />
    <section className="vault-card flex flex-wrap items-center justify-between gap-4 p-4">
      <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Workshop</p><h2 className="mt-1 truncate text-lg font-bold">{user?.garage_name || "Workshop profile"}</h2><p className="mt-1 text-xs text-muted-foreground">Registration {user?.garage_registration || "not provided"}</p></div>
      <Pill tone={user?.garage_verified && user?.vat_verified ? "success" : "warning"}>{user?.garage_verified && user?.vat_verified ? <><BadgeCheck className="h-3 w-3" /> VAT status verified</> : "Verification not confirmed"}</Pill>
      {user?.is_sample && <p className="w-full rounded-lg border border-amber-400/25 bg-amber-950/30 p-2.5 text-xs text-amber-100">Development sample workshop account. Sample approvals do not verify live VAT registration.</p>}
    </section>
    {success && <div role="status" className="vault-card flex items-start gap-3 border-success/30 p-4"><ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-success" /><div><p className="font-semibold">Record submitted</p><p className="text-sm text-muted-foreground">{success}</p></div></div>}
    <WorkshopReminders />
    {!canStamp && <div className="rounded-xl border border-amber-500/25 bg-amber-950/30 p-4 text-sm leading-relaxed text-amber-100">A server-approved workshop account with VAT verification and an active Garage Pro subscription is required to stamp service records.</div>}
    {canStamp && <form onSubmit={(event) => void submit(event)} className="vault-card space-y-5 p-5">
      <div>
        <h2 className="font-semibold text-foreground">VIN-verified fast log</h2>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">A service stamp is created only after the server confirms the vehicle record, your workshop access and the physical VIN inspection.</p>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
        <Field label="Vehicle registration"><input required minLength={2} maxLength={8} value={form.vrm} onChange={(event) => change("vrm", formatVrm(event.target.value).slice(0, 8))} placeholder="AB14 CDE" className="field font-mono uppercase" /></Field>
        <button type="button" onClick={() => void lookupVehicle()} disabled={lookupBusy || !form.vrm.trim()} className="btn-secondary min-h-11 px-3 text-xs"><Search className="h-4 w-4" />{lookupBusy ? "Looking up…" : "Fetch specs"}</button>
      </div>
      {lookupDetails && <p role="status" className={`rounded-lg border p-3 text-xs leading-relaxed ${lookupSource === "official" ? "border-emerald-400/30 bg-emerald-950/25 text-emerald-100" : "border-amber-400/25 bg-amber-950/20 text-amber-100"}`}>
        {lookupSource === "official" ? "Government source · " : "Unverified sample/supplied data · "}{lookupDetails}
      </p>}
      <div className="grid grid-cols-2 gap-3">
        <Field label="17-character VIN"><input required minLength={17} maxLength={17} value={form.vin} onChange={(event) => change("vin", event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 17))} placeholder="VIN / chassis number" className="field font-mono uppercase" /><span className="text-right text-[11px] text-muted-foreground">{form.vin.length}/17</span></Field>
        <Field label="Odometer (miles)"><input required inputMode="numeric" type="number" min={0} max={2_000_000} value={form.mileage} onChange={(event) => change("mileage", event.target.value)} placeholder="87420" className="field" /></Field>
      </div>
      <label className="flex min-h-12 items-start gap-3 rounded-xl border border-slate-700/70 p-3 text-sm text-slate-200">
        <input required type="checkbox" checked={form.physicalVinInspected} onChange={(event) => change("physicalVinInspected", event.target.checked)} className="mt-0.5 h-4 w-4 accent-cyan-400" />
        <span>I physically inspected the VIN on the vehicle and matched it to the registration and service record.</span>
      </label>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Service category</p>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CATEGORIES.map((category) => <button key={category} type="button" aria-pressed={form.category === category} onClick={() => change("category", category)}
            className={`min-h-11 rounded-xl border px-3 text-sm font-semibold transition-colors ${form.category === category ? "border-primary bg-primary/15 text-primary" : "border-slate-700 text-muted-foreground hover:border-slate-500"}`}>{category}</button>)}
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Work performed / components</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {COMPONENTS.map((component) => <button key={component} type="button" aria-pressed={form.components.includes(component)} onClick={() => toggleComponent(component)}
            className={`min-h-10 rounded-full border px-3 text-xs font-medium transition-colors ${form.components.includes(component) ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-300" : "border-slate-700 text-slate-300 hover:border-slate-500"}`}>
            {form.components.includes(component) && <Check className="mr-1 inline h-3 w-3" />}{component}
          </button>)}
        </div>
      </div>
      <Field label="Work performed / notes"><textarea rows={3} maxLength={2000} value={form.notes} onChange={(event) => change("notes", event.target.value)} placeholder="Describe the work carried out" className="field" /></Field>
      <Field label="Advisories (optional)"><textarea rows={2} maxLength={2000} value={form.advisories} onChange={(event) => change("advisories", event.target.value)} placeholder="One advisory per line" className="field" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Service date"><input type="date" value={form.date} onChange={(event) => change("date", event.target.value)} className="field" /></Field>
        <Field label="Parts cost (£)"><input type="number" min={0} step="0.01" max={1_000_000} inputMode="decimal" value={form.partsCost} onChange={(event) => change("partsCost", event.target.value)} placeholder="0.00" className="field" /></Field>
      </div>
      <Field label="Labour cost (£)"><input type="number" min={0} step="0.01" max={1_000_000} inputMode="decimal" value={form.labourCost} onChange={(event) => change("labourCost", event.target.value)} placeholder="0.00" className="field" /></Field>
       <DocumentPrivacyNotice />
       <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2 rounded-xl border border-slate-700/70 p-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-slate-200"><Camera className="h-4 w-4 text-cyan-400" /> Attach receipt photo
            <input type="file" accept="image/jpeg,image/png,image/webp,image/*" className="sr-only" disabled={fileBusy || busy} onChange={(event) => void attachReceipt(event.target.files?.[0])} />
          </label>
          <p className="text-xs text-muted-foreground">{fileBusy ? "Reading file…" : form.receipt ? "Receipt photo attached" : "Available on all account tiers; stored privately."}</p>
          {form.receipt && <button type="button" onClick={() => change("receipt", undefined)} className="text-xs text-muted-foreground underline">Remove photo</button>}
        </div>
        <div className="space-y-2 rounded-xl border border-slate-700/70 p-3">
          <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-slate-200"><FileText className="h-4 w-4 text-cyan-400" /> Attach invoice PDF
            <input type="file" accept="application/pdf,.pdf" className="sr-only" disabled={fileBusy || busy} onChange={(event) => void attachInvoice(event.target.files?.[0])} />
          </label>
          <p className="break-all text-xs text-muted-foreground">{form.invoiceName ?? "PDF invoices up to 5 MB are stored privately."}</p>
          {form.invoiceData && <button type="button" onClick={() => setForm((current) => {
            const { invoiceName: _invoiceName, invoiceData: _invoiceData, ...remaining } = current;
            return remaining;
          })} className="text-xs text-muted-foreground underline">Remove invoice</button>}
        </div>
      </div>
      {canScanInvoice && (form.invoiceData || form.receipt) && <button type="button" onClick={() => void scanInvoice()} disabled={scanBusy} className="btn-secondary min-h-11 w-full">
        {scanBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}{scanBusy ? "Scanning on this device…" : "Scan locally and suggest fields"}
      </button>}
      {scanMessage && <p role="status" className="rounded-lg border border-amber-400/30 bg-amber-950/20 p-3 text-sm text-amber-100">{scanMessage}</p>}
      {draftStatus && <p role="status" className="rounded-lg border border-slate-700 bg-slate-950/50 p-3 text-xs text-slate-300">{draftStatus}</p>}
       {queueStatus && <p role="status" className="rounded-lg border border-cyan-400/40 bg-cyan-950/50 p-3 text-sm text-cyan-50">{queueStatus}</p>}
      {error && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-950/25 p-3 text-sm text-red-200">{error}</p>}
      <p className="text-xs leading-relaxed text-muted-foreground">If the connection is unavailable, this form is saved as a local draft. A draft is not a service stamp and cannot be shown as verified until the server accepts it.</p>
      <button type="submit" disabled={busy || fileBusy} className="btn-primary w-full py-4"><Upload className="h-5 w-5" />{busy ? "Saving signed service record…" : "Stamp verified job to vehicle passport"}</button>
    </form>}
  </div>;
}

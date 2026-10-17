import { createFileRoute, useLocation } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { Camera, Check, CheckCircle, CheckCircle2, FileText, Info, LoaderCircle, LockKeyhole, Search, ShieldCheck, Timer, Upload, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Field, PageHeader } from "@/components/vault/ui-bits";
import { MotStatusPill } from "@/components/vault/MotStatusPill";
import { formatVrm, readImage, today, type MotReading } from "@/lib/vault-store";
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
import { AIScanButton, isoDateFromUkDate } from "@/components/service/AIScanButton";
import { UpgradeDialog } from "@/components/vault/UpgradeDialog";

const CATEGORIES = ["Servicing", "Brakes", "Repairs", "Tyres"] as const;
const COMPONENTS = [
  "Engine oil", "Oil filter", "Air filter", "Cabin filter", "Spark plugs",
  "Brake pads", "Brake discs", "Brake fluid", "Tyres", "Battery", "Coolant", "Suspension",
];
const QUICK_COMPONENTS = ["Engine oil", "Oil filter", "Brake pads", "Tyres"] as const;
const GARAGE_INPUT_CLASS =
  "appearance-none [-webkit-appearance:none] w-full min-w-0 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2.5 text-base text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500/50";
const componentLabel = (component: string) =>
  component.replace(/\b(engine oil|oil filter|brake pads)\b/i, (match) => match.replace(/\b\w/g, (letter) => letter.toUpperCase()));

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
  totalCost: string;
  receipt?: string;
  invoiceName?: string;
  invoiceData?: string;
};

function emptyForm(): GarageForm {
  return { vrm: "", vin: "", physicalVinInspected: false, mileage: "", date: today(), category: "Servicing", components: [], notes: "", advisories: "", partsCost: "", labourCost: "", totalCost: "" };
}

function hasDraftContent(form: GarageForm) {
  return Boolean(form.vrm.trim() || form.vin.trim() || form.physicalVinInspected || form.mileage || form.components.length ||
    form.notes.trim() || form.advisories.trim() || form.partsCost || form.labourCost || form.totalCost ||
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
  const activeTab = useLocation().pathname;
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const account = useAccount();
  const user = account?.state?.user;
  const accountRefreshRef = useRef(account?.refresh);
  const syncingOutboxRef = useRef(false);
  const autoLookupRef = useRef("");
  const adminBypass = user?.role === "dev_admin" || user?.permissions?.includes("all_access") === true;
  const canEnterWorkshop = Boolean(user && (adminBypass || canUseWorkshopFeatures(user)));
  const canStamp = adminBypass || Boolean(user && canUseWorkshopFeatures(user));
  const canScanInvoice = Boolean(user && (user.role === "dev_admin" || user.subscription_tier !== "free" || user.workshop_access_active));
  const draftKey = user ? `garage-service:${user.id}` : null;
  const [form, setForm] = useState<GarageForm>(emptyForm);
  const [readyDraftKey, setReadyDraftKey] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState("");
  const [lookupDetails, setLookupDetails] = useState("");
  const [lookupMotHistory, setLookupMotHistory] = useState<MotReading[]>([]);
  const [lookupMotExpiry, setLookupMotExpiry] = useState("");
  const [lookupMotStatus, setLookupMotStatus] = useState("");
  const [lookupMotSource, setLookupMotSource] = useState<"official" | undefined>();
  const [lookupSource, setLookupSource] = useState<"official" | "unverified" | null>(null);
  const [boundVin, setBoundVin] = useState("");
  const [lookupBusy, setLookupBusy] = useState(false);
  const [fileBusy, setFileBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [scanBusy, setScanBusy] = useState(false);
  const [scanMessage, setScanMessage] = useState("");
  const [showDetailedBreakdown, setShowDetailedBreakdown] = useState(false);
  const [showExpressHelp, setShowExpressHelp] = useState(false);
  const [showMoreComponents, setShowMoreComponents] = useState(false);
  const [showWorkshopUpgrade, setShowWorkshopUpgrade] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [queuedCount, setQueuedCount] = useState(0);
  const [queueStatus, setQueueStatus] = useState("");

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
      mainContainerRef.current?.scrollTo({ top: 0, left: 0, behavior: "instant" });
      document.querySelector<HTMLElement>(".overflow-y-auto")?.scrollTo({ top: 0, left: 0, behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [activeTab]);

  useEffect(() => {
    accountRefreshRef.current = account?.refresh;
  }, [account?.refresh]);

  useEffect(() => {
    const normalized = form.vrm.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    if (normalized.length < 6 || validateVIN(form.vin) || lookupBusy || autoLookupRef.current === normalized) return;
    const timer = window.setTimeout(() => {
      autoLookupRef.current = normalized;
      void lookupVehicle();
    }, 650);
    return () => window.clearTimeout(timer);
  }, [form.vrm, form.vin, lookupBusy]);

  useEffect(() => {
    if (!draftKey) {
      setReadyDraftKey(null);
      return;
    }
    let active = true;
    setForm(emptyForm());
    setBoundVin("");
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

  function changeRegistration(value: string) {
    const vrm = formatVrm(value).slice(0, 8);
    setForm((current) => {
      const registrationChanged = formatVrm(current.vrm) !== vrm;
      return {
        ...current,
        vrm,
        ...(registrationChanged ? { vin: "", physicalVinInspected: false } : {}),
      };
    });
    if (formatVrm(form.vrm) !== vrm) {
      setBoundVin("");
      setLookupMotHistory([]);
    }
  }

  async function lookupVehicle() {
    if (lookupBusy || !form.vrm.trim()) return;
    autoLookupRef.current = form.vrm.replace(/[^A-Z0-9]/gi, "").toUpperCase();
    setLookupBusy(true);
    setError("");
    setLookupDetails("");
    try {
      const response = await fetch(`/api/vehicle/lookup?vrm=${encodeURIComponent(form.vrm)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Vehicle lookup failed.");
      const vehicle = payload.vehicle;
      const lookedUpVin = typeof vehicle.vin === "string" && validateVIN(vehicle.vin)
        ? vehicle.vin.trim().toUpperCase()
        : "";
      setForm((current) => ({
        ...current,
        vrm: vehicle.vrm,
        vin: lookedUpVin,
        physicalVinInspected: false,
        mileage: vehicle.odometerAvailable === false ? current.mileage : String(vehicle.odometer ?? current.mileage),
      }));
      setBoundVin(lookedUpVin);
      setLookupMotHistory(Array.isArray(vehicle.motHistory) ? vehicle.motHistory : []);
      setLookupMotExpiry(typeof vehicle.motExpiry === "string" ? vehicle.motExpiry : "");
      setLookupMotStatus(typeof vehicle.motStatus === "string" ? vehicle.motStatus : "");
      setLookupMotSource(vehicle.motHistorySource === "official" || vehicle.source === "official" ? "official" : undefined);
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
      setShowDetailedBreakdown(true);
      setError("");
      return;
    }
    if (!form.physicalVinInspected) {
      setShowDetailedBreakdown(true);
      setError("Confirm that you physically inspected and matched the VIN on the vehicle.");
      return;
    }
    if (!form.components.length && !form.notes.trim()) {
      setShowDetailedBreakdown(true);
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
    const totalCost = form.totalCost ? Number(form.totalCost) : (partsCost ?? 0) + (labourCost ?? 0);
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

  if (!canEnterWorkshop) return <div key={activeTab} ref={mainContainerRef} className="space-y-5 px-4 pt-4">
    <PageHeader icon={<Wrench className="h-5 w-5 text-primary" />} title="Workshop terminal" subtitle="Verified workshop stamping tools." />
    <section className="vault-card space-y-4 p-5" aria-labelledby="workshop-access-title">
      <div className="flex items-center gap-3">
        <LockKeyhole className="h-5 w-5 shrink-0 text-amber-400" />
        <h2 id="workshop-access-title" className="text-lg font-bold">Verified Workshop Access Required</h2>
      </div>
      <p className="text-sm leading-relaxed text-slate-300">Digital stamping tools are exclusively reserved for verified garages, technicians, and specialists to maintain V5Vault record integrity.</p>
      <button type="button" onClick={() => setShowWorkshopUpgrade(true)} className="btn-primary min-h-12 w-full">Start 30-Day Free Trial (£9.99/mo)</button>
      <button type="button" onClick={() => window.location.assign("/vehicle")} className="btn-secondary min-h-12 w-full">Return to Vehicle Passport</button>
    </section>
    <UpgradeDialog open={showWorkshopUpgrade} onOpenChange={setShowWorkshopUpgrade} tier="Verified Workshop" price="£9.99/mo" description="30-day trial. Workshop approval and VAT verification are required before live stamping." perks={["Verified digital service stamps", "Workshop customer and booking tools", "Local invoice scanning and offline queue"]} />
  </div>;

  return <div key={activeTab} ref={mainContainerRef} className="space-y-5 px-4 pt-4">
    <PageHeader icon={<Wrench className="h-5 w-5 text-primary" />} title={user?.garage_name || "Workshop Terminal"} />
    {canStamp && <section className="vault-card overflow-hidden">
      <form onSubmit={(event) => void submit(event)} className="space-y-4 p-4">
        <div className="flex items-center gap-1.5">
          <h3 className="text-base font-semibold text-white">Express Core</h3>
          <button type="button" aria-expanded={showExpressHelp} aria-label="About Express Core" onClick={() => setShowExpressHelp((open) => !open)} className="inline-flex min-h-11 min-w-11 items-center justify-start rounded-full text-slate-400 hover:bg-slate-800 hover:text-cyan-300"><Info className="h-4 w-4 cursor-pointer text-slate-400" /></button>
        </div>
        {showExpressHelp && <p role="status" className="rounded-lg border border-cyan-500/20 bg-cyan-950/20 px-3 py-2 text-xs leading-relaxed text-cyan-100">Express Core: High-speed 15-second service stamping bound directly to the chassis VIN.</p>}
        <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/40 p-3">
          <div className="space-y-3">
            <div className="min-w-0">
              <Field label="Vehicle registration">
                <div className="flex min-w-0 items-center gap-2">
                  <input id="garage-vehicle-registration" required minLength={2} maxLength={8} value={form.vrm} onChange={(event) => changeRegistration(event.target.value)} placeholder="AB14 CDE" className={`${GARAGE_INPUT_CLASS} min-h-[44px] flex-1 font-mono uppercase`} />
                  <button type="button" onClick={() => void lookupVehicle()} disabled={lookupBusy || !form.vrm.trim()} className="btn-secondary min-h-[44px] shrink-0 gap-1 px-2 text-[11px] whitespace-nowrap">{lookupBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}{lookupBusy ? "Looking…" : "Fetch specs"}</button>
                </div>
              </Field>
              {boundVin && boundVin === form.vin && <div role="status" className="mt-2 flex min-w-0 items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 font-mono text-xs text-emerald-400">
                <CheckCircle className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                <span className="break-all">VIN Bound: {form.vin}</span>
              </div>}
              {lookupDetails && <p role="status" className={`mt-1.5 flex items-center gap-1 text-[11px] font-medium ${lookupSource === "official" ? "text-emerald-300" : "text-amber-400/90"}`}>
                {lookupSource === "official"
                  ? lookupDetails
                  : form.vrm.replace(/[^A-Z0-9]/gi, "").toUpperCase() === "AB14CDE"
                    ? <><span aria-hidden="true">⚠️</span> Demo sample data (2014 Audi A4 2.0 TDI) · Not official DVLA lookup</>
                    : form.vrm.replace(/[^A-Z0-9]/gi, "").toUpperCase() === "LG57VYF"
                      ? <>Vehicle details supplied · Not an official DVLA lookup</>
                      : <>Demo sample data · Not official DVLA lookup</>}
              </p>}
              <MotStatusPill source={lookupSource === "official" ? "official" : "user-provided"} motHistorySource={lookupMotSource} motStatus={lookupMotStatus} motExpiry={lookupMotExpiry} className="mt-2" />
              {lookupMotHistory.length > 0 && <div className="mt-2 rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-xs">
                <h4 className="font-semibold text-slate-200">MOT history</h4>
                <div className="mt-2 space-y-2">
                  {lookupMotHistory.slice(-3).reverse().map((reading, index) => <div key={`${reading.date}-${index}`} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 border-t border-slate-800 pt-2">
                    <span className="text-slate-300">{reading.date} · {reading.result}{reading.mileage !== undefined ? ` · ${reading.mileage.toLocaleString("en-GB")} miles` : ""}</span>
                    {reading.advisories?.length ? <ul className="w-full list-disc space-y-0.5 pl-4 text-amber-200/80">{reading.advisories.map((advisory, advisoryIndex) => <li key={`${advisoryIndex}-${advisory}`}>{advisory}</li>)}</ul> : null}
                  </div>)}
                </div>
              </div>}
              {!validateVIN(form.vin) ? <p role="status" className="mt-2 text-[11px] leading-snug text-amber-200">17-character VIN required for permanent chassis log.</p> : boundVin !== form.vin && <p role="status" className="mt-2 text-[11px] leading-snug text-amber-200">Fetch specs to bind this VIN to the registration before stamping.</p>}
            </div>
            <Field label="Odometer (miles)"><input required inputMode="numeric" type="number" min={0} max={2_000_000} value={form.mileage} onChange={(event) => change("mileage", event.target.value)} placeholder="87420" className={`${GARAGE_INPUT_CLASS} min-h-[44px]`} /></Field>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Service category</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {CATEGORIES.map((category) => <button key={category} type="button" aria-pressed={form.category === category} onClick={() => change("category", category)}
                className={`min-h-11 rounded-lg border px-2 text-xs font-semibold transition-colors ${form.category === category ? "border-primary bg-primary/15 text-primary" : "border-slate-700 text-muted-foreground hover:border-slate-500"}`}>{category}</button>)}
            </div>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Work components</p>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {(showMoreComponents ? COMPONENTS : QUICK_COMPONENTS).map((component) => <button key={component} type="button" aria-pressed={form.components.includes(component)} onClick={() => toggleComponent(component)}
                className="h-8 px-3 text-xs font-medium bg-slate-900 border border-slate-800 text-slate-300 rounded-full flex items-center justify-center whitespace-nowrap transition-all hover:border-slate-700">
                {form.components.includes(component) && <Check className="mr-1 inline h-3 w-3" />}{componentLabel(component)}
              </button>)}
              <button type="button" aria-expanded={showMoreComponents} onClick={() => setShowMoreComponents((expanded) => !expanded)} className="h-8 px-3 text-xs font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 rounded-full flex items-center justify-center whitespace-nowrap hover:bg-cyan-500/20">{showMoreComponents ? "- Fewer components" : "+ More components"}</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Service date"><input type="date" value={form.date} onChange={(event) => change("date", event.target.value)} className={`${GARAGE_INPUT_CLASS} min-w-0`} /></Field>
            <Field label="Invoice total (£)"><input type="number" min={0} step="0.01" max={1_000_000} inputMode="decimal" value={form.totalCost} onChange={(event) => change("totalCost", event.target.value)} placeholder="0.00" className={`${GARAGE_INPUT_CLASS} min-w-0`} /></Field>
          </div>
        </section>

        <button type="submit" disabled={busy || fileBusy || !validateVIN(form.vin) || boundVin !== form.vin} className="btn-primary min-h-[44px] w-full px-3 py-3 disabled:cursor-not-allowed disabled:opacity-50"><Upload className="h-5 w-5" />{busy ? "Saving signed service record…" : "Stamp verified job to vehicle passport"}</button>
        {error && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-950/25 p-3 text-sm text-red-200">{error}</p>}

        <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/40">
          <button type="button" aria-expanded={showDetailedBreakdown} onClick={() => setShowDetailedBreakdown((open) => !open)} className="flex min-h-[44px] w-full items-center justify-between gap-3 p-3 text-left text-sm font-semibold">
            <span>Add Detailed Breakdown &amp; Receipt {showDetailedBreakdown ? "˄" : "˅"}</span>
          </button>
          {showDetailedBreakdown && <div className="my-3 space-y-4 rounded-xl border border-slate-800 bg-slate-900/80 p-4">
            <AIScanButton canScan={canScanInvoice} isAdmin={user?.role === "dev_admin"} onScanned={(fields, scannedImage) => {
              setForm((current) => ({
                ...current,
                date: isoDateFromUkDate(fields.date) ?? current.date,
                mileage: fields.mileage ? String(fields.mileage) : current.mileage,
                notes: fields.workSummary || current.notes,
                components: current.components.length ? current.components : fields.workSummary.split(/[;,.\n]+/).map((item) => item.trim()).filter(Boolean).slice(0, 12),
                totalCost: fields.totalCost ? String(fields.totalCost) : current.totalCost,
                ...(scannedImage ? { receipt: scannedImage } : {}),
              }));
            }} />
            <div className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-400">Locked Chassis VIN: <span className="font-mono font-semibold text-emerald-400">{form.vin || "Not yet bound"}</span></div>
            <label className="flex min-h-12 items-start gap-3 rounded-xl border border-slate-700/70 p-3 text-sm text-slate-200">
              <input type="checkbox" checked={form.physicalVinInspected} onChange={(event) => change("physicalVinInspected", event.target.checked)} className="mt-0.5 h-4 w-4 accent-cyan-400" />
              <span>I physically inspected the VIN on the vehicle and matched it to the registration and service record.</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Parts cost (£)"><input type="number" min={0} step="0.01" max={1_000_000} inputMode="decimal" value={form.partsCost} onChange={(event) => change("partsCost", event.target.value)} placeholder="0.00" className={GARAGE_INPUT_CLASS} /></Field>
              <Field label="Labour cost (£)"><input type="number" min={0} step="0.01" max={1_000_000} inputMode="decimal" value={form.labourCost} onChange={(event) => change("labourCost", event.target.value)} placeholder="0.00" className={GARAGE_INPUT_CLASS} /></Field>
            </div>
            <Field label="Work performed / notes"><textarea rows={3} maxLength={2000} value={form.notes} onChange={(event) => change("notes", event.target.value)} placeholder="Describe the work carried out" className={GARAGE_INPUT_CLASS} /></Field>
            <Field label="Advisories (optional)"><textarea rows={2} maxLength={2000} value={form.advisories} onChange={(event) => change("advisories", event.target.value)} placeholder="One advisory per line" className={GARAGE_INPUT_CLASS} /></Field>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="min-w-0 space-y-2">
                <label className="flex min-h-[72px] w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-700/80 bg-slate-900/60 p-3 text-center text-sm text-slate-200 hover:bg-slate-800/60">
                  <Camera className="h-5 w-5 shrink-0 text-cyan-400" /> Photo / Image
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/*" className="sr-only" disabled={fileBusy || busy} onChange={(event) => void attachReceipt(event.target.files?.[0])} />
                </label>
                <p className="text-xs leading-snug text-muted-foreground">{fileBusy ? "Reading file…" : form.receipt ? "Receipt photo attached" : "Image stored privately on all tiers."}</p>
                {form.receipt && <button type="button" onClick={() => change("receipt", undefined)} className="inline-flex min-h-[44px] min-w-[44px] items-center text-xs text-muted-foreground underline">Remove photo</button>}
              </div>
              <div className="min-w-0 space-y-2">
                <label className="flex min-h-[72px] w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-slate-700/80 bg-slate-900/60 p-3 text-center text-sm text-slate-200 hover:bg-slate-800/60">
                  <FileText className="h-5 w-5 shrink-0 text-cyan-400" /> PDF Document
                  <input type="file" accept="application/pdf,.pdf" className="sr-only" disabled={fileBusy || busy} onChange={(event) => void attachInvoice(event.target.files?.[0])} />
                </label>
                <p className="break-words text-xs leading-snug text-muted-foreground">{form.invoiceName ?? "PDF stored privately · 5 MB max."}</p>
                {form.invoiceData && <button type="button" onClick={() => setForm((current) => {
                  const { invoiceName: _invoiceName, invoiceData: _invoiceData, ...remaining } = current;
                  return remaining;
                })} className="inline-flex min-h-[44px] min-w-[44px] items-center text-xs text-muted-foreground underline">Remove invoice</button>}
              </div>
            </div>
            {canScanInvoice && (form.invoiceData || form.receipt) && <button type="button" onClick={() => void scanInvoice()} disabled={scanBusy} className="btn-secondary min-h-11 w-full">
              {scanBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}{scanBusy ? "Scanning on this device…" : "Scan locally and suggest fields"}
            </button>}
            {scanMessage && <p role="status" className="rounded-lg border border-amber-400/30 bg-amber-950/20 p-3 text-sm text-amber-100">{scanMessage}</p>}
            <p className="text-xs leading-relaxed text-muted-foreground">If the connection is unavailable, this form is saved as a local draft. A draft is not a service stamp until the server accepts it.</p>
          </div>}
        </section>
        {draftStatus && <div role="status" className="w-full flex justify-center py-2"><span className="rounded-full border border-slate-800/60 bg-slate-900/60 px-3 py-1 font-mono text-[11px] text-slate-500">Status: Local Draft (Pending Server Stamp)</span></div>}
        {queueStatus && <p role="status" className="rounded-lg border border-cyan-400/40 bg-cyan-950/50 p-3 text-sm text-cyan-50">{queueStatus}</p>}
      </form>
    </section>}
    {!canStamp && <div className="rounded-xl border border-amber-500/25 bg-amber-950/30 p-4 text-sm leading-relaxed text-amber-100">A server-approved workshop account with VAT verification and an active Garage Pro subscription is required to stamp service records.</div>}
    {success && <div role="status" className="vault-card flex items-start gap-3 border-success/30 p-4"><ShieldCheck className="mt-0.5 h-6 w-6 shrink-0 text-success" /><div><p className="font-semibold">Record submitted</p><p className="text-sm text-muted-foreground">{success}</p></div></div>}
  </div>;
}

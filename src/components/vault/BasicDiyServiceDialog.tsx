import { useState } from "react";
import { toast } from "sonner";
import { Wrench } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ModalHeader } from "@/components/vault/ModalHeader";
import { DocumentPrivacyNotice, ImagePicker, ModalField, ModalFieldGroup, MODAL_INPUT_CLASS, MODAL_SELECT_CLASS, MODAL_TEXTAREA_CLASS } from "@/components/vault/ui-bits";
import { PdfReceiptPicker } from "@/components/vault/PdfReceiptPicker";
import { SERVICE_CATEGORIES, can, today, useVault, type ServiceCategory } from "@/lib/vault-store";
import { AIScanButton, isoDateFromUkDate } from "@/components/service/AIScanButton";

const QUICK_WORK_ITEMS = ["Oil & filter", "Brakes", "Tyres", "Battery", "Coolant", "Inspection"];

export function BasicDiyServiceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { vehicle, addService, role } = useVault();
  const [date, setDate] = useState(today());
  const [mileage, setMileage] = useState("");
  const [category, setCategory] = useState<ServiceCategory>("Servicing");
  const [description, setDescription] = useState("");
  const [totalCost, setTotalCost] = useState("");
  const [image, setImage] = useState<string>();
  const [pdf, setPdf] = useState<{ name: string; data: string }>();
  const [readingPdf, setReadingPdf] = useState(false);
  const [saving, setSaving] = useState(false);

  function toggleWorkItem(item: string) {
    setDescription((current) => {
      const lines = current.split(/\n+/).map((line) => line.trim()).filter(Boolean);
      const index = lines.findIndex((line) => line.toLowerCase() === item.toLowerCase());
      if (index >= 0) lines.splice(index, 1);
      else lines.push(item);
      return lines.join("\n").slice(0, 1000);
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (vehicle.is_scrapped) {
      toast.error("This scrapped vehicle passport is read-only.");
      return;
    }
    const parsedMileage = Number.parseInt(mileage, 10);
    const lines = description.trim().slice(0, 1000).split(/\n+/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length || !Number.isInteger(parsedMileage) || parsedMileage < 0 || parsedMileage > 2_000_000) {
      toast.error("Add work performed and a valid mileage.");
      return;
    }

    setSaving(true);
    try {
      const saved = await addService({
        vrm: vehicle.vrm,
        date,
        mileage: parsedMileage,
        category,
        description: (lines[0] ?? "").slice(0, 80),
        items: lines.slice(1),
        cost: totalCost ? Number(totalCost) : undefined,
        garage: "Owner logged DIY",
        verified: false,
        is_verified_stamp: false,
        image,
        invoice_name: pdf?.name,
        invoice_data: pdf?.data,
      });
      if (saved === false) throw new Error("A linked vehicle was not found for this record.");
      toast.success("DIY service entry added to your timeline");
      setDate(today());
      setMileage("");
      setCategory("Servicing");
      setDescription("");
      setTotalCost("");
      setImage(undefined);
      setPdf(undefined);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Record could not be saved");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="flex max-h-[var(--dialog-max-height,90dvh)] flex-col gap-4 overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950 p-5 shadow-2xl">
        <ModalHeader className="border-0 bg-transparent px-0 py-0">
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" /> Add a Basic DIY Service Entry
          </DialogTitle>
          <DialogDescription>Enter the service details yourself. Receipt photo or PDF proof is optional and available on every plan.</DialogDescription>
        </ModalHeader>
        <form onSubmit={(event) => void submit(event)} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain scroll-p-1 p-1">
            <DocumentPrivacyNotice />
            <AIScanButton canScan={can.diy(role)} isAdmin={role === "superadmin"} onScanned={(fields, scannedImage) => {
              setDate(isoDateFromUkDate(fields.date) ?? date);
              if (fields.mileage) setMileage(String(fields.mileage));
              setDescription(fields.workSummary);
              if (fields.totalCost > 0) setTotalCost(String(fields.totalCost));
              if (scannedImage) setImage(scannedImage);
            }} />
            <div className="grid w-full min-w-0 grid-cols-2 gap-3">
              <ModalField label="Date">{(id) => (
                <input id={id} type="date" max={today()} required value={date} onChange={(event) => setDate(event.target.value)} className={`${MODAL_INPUT_CLASS} text-base`} />
              )}</ModalField>
              <ModalField label="Mileage">{(id) => (
                <input id={id} inputMode="numeric" pattern="[0-9]*" required placeholder="87,420" value={mileage} onChange={(event) => setMileage(event.target.value.replace(/\D/g, ""))} className={`${MODAL_INPUT_CLASS} text-base`} />
              )}</ModalField>
            </div>
            <ModalField label="Category" select>{(id) => (
              <select id={id} value={category} onChange={(event) => setCategory(event.target.value as ServiceCategory)} className={`${MODAL_SELECT_CLASS} text-base`}>
                {SERVICE_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
              </select>
            )}</ModalField>
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Quick add work items</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_WORK_ITEMS.map((item) => {
                  const selected = description.split(/\n+/).some((line) => line.trim().toLowerCase() === item.toLowerCase());
                  return <button key={item} type="button" aria-pressed={selected} onClick={() => toggleWorkItem(item)} className={`min-h-10 rounded-full border px-3 text-xs font-medium transition-colors ${selected ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-300" : "border-slate-700 text-slate-300 hover:border-slate-500"}`}>
                    {item}
                  </button>;
                })}
              </div>
            </div>
            <ModalField label="Work performed">{(id) => (
              <textarea id={id} rows={4} maxLength={1000} required value={description} onChange={(event) => setDescription(event.target.value)} placeholder={"Oil and filter changed\nTyre pressures checked"} className={`${MODAL_TEXTAREA_CLASS} text-base`} />
            )}</ModalField>
            <ModalField label="Invoice total (£) · optional">{(id) => (
              <input id={id} type="number" min={0} max={1_000_000} step="0.01" inputMode="decimal" value={totalCost} onChange={(event) => setTotalCost(event.target.value)} placeholder="0.00" className={`${MODAL_INPUT_CLASS} text-base`} />
            )}</ModalField>
            <div className="grid grid-cols-2 gap-3">
              <ModalFieldGroup label="Optional receipt photo">
                <ImagePicker value={image} onChange={setImage} label="Photo / Image" />
              </ModalFieldGroup>
              <ModalFieldGroup label="Optional invoice PDF">
                <PdfReceiptPicker onChange={setPdf} onReadingChange={setReadingPdf} label="PDF Document" />
              </ModalFieldGroup>
            </div>
          </div>
          <footer className="sticky bottom-0 z-20 flex-none bg-slate-950 pt-2">
            <button type="submit" disabled={saving || readingPdf} className="btn-primary mb-8 w-full">
              {readingPdf ? "Reading PDF…" : saving ? "Saving record…" : "Save to Timeline"}
            </button>
          </footer>
        </form>
      </DialogContent>
    </Dialog>
  );
}

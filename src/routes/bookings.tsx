import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { CalendarDays, Check, X } from "lucide-react";
import { useAccount } from "@/lib/account-store";
import { formatVrm, today } from "@/lib/vault-store";
import { Field, PageHeader, Pill } from "@/components/vault/ui-bits";
import { toast } from "sonner";

export const Route = createFileRoute("/bookings")({ component: BookingsPage });
function BookingsPage() {
  const account = useAccount();
  const [vrm, setVrm] = useState("");
  const [date, setDate] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!account) return;
    setBusy(true);
    try { await account.book(vrm, date, notes); toast.success("Booking created"); setVrm(""); setDate(""); setNotes(""); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Booking could not be created"); }
    finally { setBusy(false); }
  }
  async function update(id: string, status: "completed" | "cancelled") {
    if (!account) return;
    setBusy(true);
    try { await account.updateBooking(id, status); toast.success(status === "completed" ? "Booking marked complete" : "Booking cancelled"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Booking could not be updated"); }
    finally { setBusy(false); }
  }
  const bookings = account?.state?.bookings ?? [];
  return <div className="space-y-5">
    <PageHeader icon={<CalendarDays className="h-5 w-5 text-primary" />} title="Bookings" subtitle="Create and manage appointments attached to real customer passports." />
    <form onSubmit={create} className="vault-card space-y-3 p-4">
      <Field label="Customer VRM"><input required minLength={2} maxLength={12} value={vrm} onChange={(e) => setVrm(formatVrm(e.target.value).slice(0,8))} className="field font-mono uppercase" placeholder="AB14 CDE" /></Field>
      <Field label="Appointment date"><input type="date" required min={today()} value={date} onChange={(e) => setDate(e.target.value)} className="field appearance-none [-webkit-appearance:none]" /></Field>
      <Field label="Notes"><textarea maxLength={1000} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="field" placeholder="Work requested" /></Field>
      <button disabled={busy} className="btn-primary w-full">Create booking</button>
    </form>
    {!bookings.length ? <div className="vault-card p-7 text-center"><CalendarDays className="mx-auto h-7 w-7 text-muted-foreground" /><h2 className="mt-3 font-bold">No bookings yet</h2><p className="mt-1 text-sm text-muted-foreground">Appointments created by your workshop and customers will show here.</p></div> : [...bookings].sort((a,b) => a.date.localeCompare(b.date)).map((b) => <article key={b.id} className="vault-card flex flex-wrap items-center justify-between gap-3 p-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-mono font-bold">{formatVrm(b.vrm)}</span><Pill tone={b.status === "booked" ? "primary" : b.status === "completed" ? "success" : "muted"}>{b.status}</Pill></div><p className="mt-1 text-sm">{new Date(`${b.date}T00:00:00`).toLocaleDateString("en-GB", { dateStyle: "long" })}</p><p className="text-xs text-muted-foreground">{b.notes || "No notes supplied"}</p></div>{b.status === "booked" && <div className="flex gap-2"><button disabled={busy} onClick={() => void update(b.id,"completed")} className="btn-ghost px-3 py-2 text-xs"><Check className="h-4 w-4" /> Complete</button><button disabled={busy} onClick={() => void update(b.id,"cancelled")} className="btn-ghost px-3 py-2 text-xs"><X className="h-4 w-4" /> Cancel</button></div>}</article>)}
  </div>;
}

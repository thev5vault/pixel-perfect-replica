import { useCallback, useEffect, useState } from "react";
import { BellRing, CalendarClock, LoaderCircle, Mail, MessageSquareText, RefreshCw } from "lucide-react";
import { Pill } from "@/components/vault/ui-bits";
import { useV1 } from "@/lib/use-v1";
import type { ReminderItem } from "@/lib/v1-types";

export function WorkshopReminders() {
  const v1 = useV1();
  const [items, setItems] = useState<ReminderItem[] | null>(null);
  const [error, setError] = useState("");
  const [consented, setConsented] = useState(false);
  const [busy, setBusy] = useState("");
  const load = useCallback(async () => { setError(""); try { setItems(await v1.getReminders()); } catch (e) { setError(message(e, "Reminder schedule could not be loaded.")); } }, [v1]);
  useEffect(() => { void load(); }, [load]);
  async function send(item: ReminderItem, channel: "email" | "sms") {
    const allowed = channel === "email" ? item.email_allowed && item.email_available : item.sms_allowed && item.sms_available;
    if (!consented || !allowed) { setError("Sending requires your explicit consent and a configured, available customer channel."); return; }
    const id = `${item.vrm}-${item.kind}-${channel}`; setBusy(id); setError("");
    try {
      const result = await v1.sendReminder({ vrm: item.vrm, kind: item.kind, due_date: item.due_date, channel });
      if (result.status === "simulated") setError(result.message);
      else await load();
    } catch (e) { setError(message(e, "Reminder could not be sent.")); }
    finally { setBusy(""); }
  }
  return <section className="vault-card overflow-hidden">
    <header className="border-b border-border p-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Workshop / follow-up</p><h2 className="mt-1 text-xl font-bold">Due soon</h2><p className="mt-1 text-sm text-muted-foreground">Only server-provided vehicles and consented contact channels appear here.</p></header>
    {error && <div className="m-4 rounded-lg border border-warning/35 bg-warning/10 p-3 text-sm" role="alert"><p>{error}</p><button type="button" onClick={() => void load()} className="mt-2 inline-flex min-h-10 items-center gap-2 underline"><RefreshCw className="h-4 w-4"/>Reload reminders</button></div>}
    {!items && !error && <div className="space-y-3 p-4" role="status">{[1,2,3].map((n) => <div key={n} className="h-20 animate-pulse rounded-xl bg-muted/60"/>)}</div>}
    {items && items.length === 0 && <div className="flex flex-col items-center px-5 py-10 text-center"><CalendarClock className="h-9 w-9 text-primary"/><h3 className="mt-3 font-bold">Nothing due right now</h3><p className="mt-1 max-w-sm text-sm text-muted-foreground">MOT and service reminders will appear when the server has eligible records.</p></div>}
    {items && items.length > 0 && <>
      <label className="mx-4 mt-4 flex items-start gap-3 rounded-lg border border-border p-3 text-sm"><input type="checkbox" className="mt-1 h-5 w-5 accent-primary" checked={consented} onChange={(e) => setConsented(e.target.checked)}/><span>I have authority to send the selected reminder and confirm the customer has opted in to this contact. Consent is required for every send session.</span></label>
      <ul className="divide-y divide-border">{items.map((item, i) => <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center" key={`${item.vrm}-${item.kind}-${item.due_date}-${i}`}>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{item.customer_label || "Customer vehicle"}</p><Pill tone={item.is_sample ? "warning" : item.kind === "mot" ? "primary" : "muted"}>{item.is_sample ? "Sample" : item.kind === "mot" ? "MOT" : "Service"}</Pill></div><p className="mt-1 font-mono text-sm">{item.vrm}</p><p className="mt-1 text-xs text-muted-foreground">Due {fmt(item.due_date)}{item.last_sent_at ? ` · Last sent ${fmt(item.last_sent_at)}` : ""}</p></div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button type="button" className="btn-ghost min-h-12" disabled={!consented || !item.email_allowed || !item.email_available || busy !== ""} onClick={() => void send(item, "email")}><Mail className="h-4 w-4"/>{busy === `${item.vrm}-${item.kind}-email` ? <LoaderCircle className="h-4 w-4 animate-spin"/> : "Email"}</button>
          <button type="button" className="btn-ghost min-h-12" disabled={!consented || !item.sms_allowed || !item.sms_available || busy !== ""} onClick={() => void send(item, "sms")}><MessageSquareText className="h-4 w-4"/>{busy === `${item.vrm}-${item.kind}-sms` ? <LoaderCircle className="h-4 w-4 animate-spin"/> : "SMS"}</button>
        </div>
      </li>)}</ul>
    </>}
    <footer className="flex items-center justify-between border-t border-border p-4 text-xs text-muted-foreground"><span><BellRing className="mr-1 inline h-4 w-4"/>No customer contact data is invented</span><button type="button" className="inline-flex min-h-10 items-center gap-2 underline" onClick={() => void load()}><RefreshCw className="h-4 w-4"/>Refresh</button></footer>
  </section>;
}
function fmt(value: string) { const d = new Date(value); return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }); }
function message(error: unknown, fallback: string) { return error instanceof Error ? error.message : fallback; }

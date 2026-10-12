import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ClipboardList, Search } from "lucide-react";
import { useAccount } from "@/lib/account-store";
import { formatVrm, fmtDate, fmtMiles } from "@/lib/vault-store";
import { PageHeader, Pill } from "@/components/vault/ui-bits";
import { WorkshopReminders } from "@/components/vault/WorkshopReminders";

export const Route = createFileRoute("/queue")({ component: QueuePage });
function QueuePage() {
  const account = useAccount();
  const [query, setQuery] = useState("");
  const state = account?.state;
  const customers = useMemo(() => {
    if (!state) return [];
    const vrms = new Set([...state.services.map((s) => s.vrm), ...state.bookings.map((b) => b.vrm)]);
    return [...vrms].map((vrm) => ({
      vrm, vehicle: state.vehicles.find((v) => v.vrm === vrm),
      services: state.services.filter((s) => s.vrm === vrm).sort((a,b) => b.date.localeCompare(a.date)),
      bookings: state.bookings.filter((b) => b.vrm === vrm),
    })).filter((c) => `${c.vrm} ${c.vehicle?.make ?? ""} ${c.vehicle?.model ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  }, [state, query]);
  return <div className="space-y-5">
     <PageHeader icon={<ClipboardList className="h-5 w-5 text-primary" />} title="Upcoming jobs" subtitle="Active bay bookings, MOT reminders, and customer follow-ups." />
    <label className="relative block"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Find a registration" className="field pl-9" /></label>
      <WorkshopReminders />
    {!customers.length ? <div className="vault-card p-8 text-center"><ClipboardList className="mx-auto h-8 w-8 text-muted-foreground" /><h2 className="mt-3 font-bold">{query ? "No matching customer records" : "No customer records yet"}</h2><p className="mt-1 text-sm text-muted-foreground">Only real service records and bookings appear here.</p></div> : customers.map((c) => <article key={c.vrm} className="vault-card p-4"><div className="flex items-start justify-between gap-3"><div><span className="uk-plate text-sm px-2 py-1">{formatVrm(c.vrm)}</span><h2 className="mt-2 font-bold">{c.vehicle ? `${c.vehicle.make} ${c.vehicle.model}` : "Vehicle passport"}</h2></div><Pill>{c.services.length} service{c.services.length === 1 ? "" : "s"}</Pill></div><div className="mt-4 space-y-2">{c.services.slice(0,3).map((s) => <div key={s.id} className="flex items-center justify-between gap-3 border-t border-slate-700 pt-2 text-sm"><div className="min-w-0"><p className="truncate font-medium">{s.description}</p><p className="text-xs text-muted-foreground">{fmtDate(s.date)} · {s.garage}</p></div><span className="shrink-0 text-xs text-muted-foreground">{fmtMiles(s.mileage)}</span></div>)}</div><div className="mt-3 flex flex-wrap gap-1.5">{c.bookings.map((b) => <Pill key={b.id} tone={b.status === "booked" ? "primary" : "muted"}>{fmtDate(b.date)} · {b.status}</Pill>)}</div></article>)}
  </div>;
}

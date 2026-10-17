import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AlertTriangle, BadgeCheck, CalendarDays, Gauge, LoaderCircle, Shield, Wrench } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Pill, Plate } from "@/components/vault/ui-bits";
import { useV1 } from "@/lib/use-v1";
import type { PublicPassport } from "@/lib/v1-types";
import { fmtDate, fmtMiles } from "@/lib/vault-store";
import { MotStatusPill } from "@/components/vault/MotStatusPill";
import { toast } from "sonner";

export const Route = createFileRoute("/v/$vrm")({
  validateSearch: (search: Record<string, unknown>) => ({ sample: search["sample"] === true || search["sample"] === "true" }),
  component: PublicBuyerPassport,
});

function PublicBuyerPassport() {
  const { vrm } = Route.useParams();
  const { sample } = Route.useSearch();
  const v1 = useV1();
  const [passport, setPassport] = useState<PublicPassport | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const normalized = vrm.trim().toUpperCase();
  useEffect(() => {
    let active = true;
    setPassport(null); setError(""); setLoading(true);
    void v1.getPublicPassport(normalized, sample).then((data) => { if (active) setPassport(data); })
      .catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : "This buyer passport is unavailable."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [normalized, sample, v1]);
  const mileage = useMemo(() => {
    if (!passport) return [];
    const official = passport.mot_history.filter((entry) => entry.mileage !== undefined).map((entry) => ({ date: entry.date, mileage: entry.mileage as number, source: "MOT record" }));
    const service = passport.services.map((entry) => ({ date: entry.date, mileage: entry.mileage, source: entry.garage }));
    return [...official, ...service].sort((a, b) => a.date.localeCompare(b.date));
  }, [passport]);
  async function upgradeToFullReport() {
    if (!passport || checkoutBusy) return;
    setCheckoutBusy(true);
    try {
      const fullRoute = `/passport/${encodeURIComponent(normalized)}/full`;
      const result = await v1.checkout("sales_pack", normalized, undefined, fullRoute);
      if (!result.url) throw new Error(result.message || "Sales-pack checkout is unavailable.");
      window.location.assign(result.url);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Checkout could not be started.";
      toast.error(message);
    } finally {
      setCheckoutBusy(false);
    }
  }
  return <main className="mx-auto min-h-[100dvh] w-full max-w-5xl space-y-5 px-4 pb-28 pt-6 sm:px-6 sm:pt-10">
    <header className="flex items-center justify-between gap-3 border-b border-border pb-4">
      <div><p className="font-display text-lg font-extrabold tracking-tight">V5Vault</p><p className="text-xs text-muted-foreground">Buyer passport · private vehicle history</p></div>
      <Pill tone={passport?.is_sample ? "warning" : "primary"}>{passport?.is_sample || sample ? "Development sample" : "Read-only buyer view"}</Pill>
    </header>
    {loading && <div role="status" className="space-y-4"><div className="h-48 animate-pulse rounded-2xl bg-muted/60"/><div className="h-60 animate-pulse rounded-2xl bg-muted/60"/><div className="h-40 animate-pulse rounded-2xl bg-muted/60"/></div>}
    {error && <section className="vault-card p-6" role="alert"><AlertTriangle className="h-7 w-7 text-warning"/><h1 className="mt-3 text-xl font-bold">Passport unavailable</h1><p className="mt-2 text-sm text-muted-foreground">{error}</p><p className="mt-4 text-xs text-muted-foreground">Confirm the public link with the vehicle keeper. This page cannot unlock a private passport.</p></section>}
    {passport && <>
      {(passport.is_sample || sample || passport.vehicle.source === "demo") && <div className="rounded-xl border border-warning/35 bg-warning/10 p-4 text-sm"><strong className="text-warning">Development sample — not a live vehicle record.</strong><p className="mt-1 text-muted-foreground">Sample material is for interface demonstration only. It is not official government data or certification.</p></div>}
      {!passport.published && !passport.is_sample && <div className="rounded-xl border border-warning/35 bg-warning/10 p-4 text-sm">This snapshot is private to the owner. A public buyer link has not been enabled.</div>}
      <section className="vault-card relative overflow-hidden p-5 sm:p-8">
        <div className="absolute right-0 top-0 h-32 w-32 rounded-bl-full bg-primary/10"/>
        <div className="relative flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Vehicle record / {passport.published ? "shared by keeper" : "owner preview"}</p><h1 className="mt-2 font-display text-3xl font-extrabold sm:text-4xl">{passport.vehicle.make} {passport.vehicle.model}</h1><p className="mt-2 text-sm text-muted-foreground">{passport.vehicle.year ?? "Year not supplied"}{passport.vehicle.colour ? ` · ${passport.vehicle.colour}` : ""}{passport.vehicle.fuelType ? ` · ${passport.vehicle.fuelType}` : ""}</p></div><Plate vrm={passport.vehicle.vrm} size="lg"/></div>
        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat icon={<Gauge/>} label="Current mileage" value={passport.vehicle.odometerAvailable === false ? "Not supplied" : fmtMiles(passport.vehicle.odometer)}/>
          <Stat icon={<CalendarDays/>} label="First registered" value={passport.vehicle.registrationDate ? fmtDate(passport.vehicle.registrationDate) : "Not supplied"}/>
          <Stat icon={<CalendarDays/>} label="MOT expiry" value={passport.vehicle.motExpiry ? fmtDate(passport.vehicle.motExpiry) : "Not supplied"}/>
          <Stat icon={<Wrench/>} label="Service records" value={String(passport.services.length)}/>
          <Stat icon={<BadgeCheck/>} label="Workshop stamps" value={String(passport.verified_stamp_count)}/>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <MotStatusPill source={passport.vehicle.source} motHistorySource={passport.vehicle.motHistorySource} motStatus={passport.vehicle.motStatus} motExpiry={passport.vehicle.motExpiry} />
          <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {passport.vehicle.verification_tier === "government_data" ? "Government data matched" : passport.vehicle.verification_tier === "workshop_checked" ? "Workshop checked" : "Provisional vehicle data"}
          </span>
          {passport.vehicle.is_scrapped && <span role="status" className="rounded-full border border-amber-500/35 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-800">Scrapped · history read-only</span>}
        </div>
        {passport.vehicle.is_scrapped && <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/5 p-3 text-xs text-amber-900">This vehicle is marked as scrapped. The shared passport preserves its history and does not accept new records.</p>}
        {passport.vehicle.source === "user-provided" && <p className="mt-4 rounded-lg border border-warning/35 bg-warning/10 p-3 text-xs text-warning">
          Vehicle specifications were supplied for this record and have not been verified by a live DVLA/DVSA lookup.
        </p>}
        <div className="mt-5 flex items-center gap-2 rounded-lg border border-border bg-background/40 p-3 text-xs text-muted-foreground"><Shield className="h-4 w-4 shrink-0 text-primary"/>Keeper contact details and V5C reference are never displayed. VIN {passport.vehicle.vin ? `ending ${passport.vehicle.vin.slice(-4).padStart(Math.min(4, passport.vehicle.vin.length), "•")}` : "not available"}.</div>
      </section>
      {passport.published && !passport.is_sample && !passport.buyer_report_unlocked && <section className="vault-card flex flex-col items-start justify-between gap-4 p-5 sm:flex-row sm:items-center">
        <div><p className="text-xs font-semibold uppercase tracking-wider text-primary">Full buyer report</p><p className="mt-1 text-sm text-muted-foreground">Unlock the complete shared history and download-ready provenance snapshot for this vehicle.</p></div>
        <button type="button" onClick={() => void upgradeToFullReport()} disabled={checkoutBusy} className="btn-primary min-h-11 w-full shrink-0 sm:w-auto">
          {checkoutBusy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
          Upgrade to Full Buyer Report
        </button>
      </section>}
      <section className="vault-card p-4 sm:p-6">
        <div className="mb-3"><p className="text-xs font-semibold uppercase tracking-wider text-primary">01 / Mileage</p><h2 className="mt-1 text-xl font-bold">MOT mileage trend</h2><p className="mt-1 text-xs text-muted-foreground">MOT readings and workshop odometer entries. Source labels reflect record provenance.</p></div>
        {mileage.length > 0 ? <div className="h-64 w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={mileage} margin={{ left: -14, right: 10, top: 8, bottom: 0 }}><CartesianGrid stroke="rgba(148,163,184,.2)" vertical={false}/><XAxis dataKey="date" tickFormatter={(date: string) => date.slice(0,4)} stroke="#94a3b8" fontSize={11}/><YAxis tickFormatter={(v: number) => `${Math.round(v / 1000)}k`} stroke="#94a3b8" fontSize={11}/><Tooltip contentStyle={{ background: "#1e293b", border: "1px solid rgba(148,163,184,.3)", borderRadius: 10, color: "#f8fafc", fontSize: 12 }} labelFormatter={(d) => fmtDate(String(d))} formatter={(value: number, _name, item) => [fmtMiles(value), (item.payload as { source: string }).source]}/><Line type="monotone" dataKey="mileage" stroke="#67c1cb" strokeWidth={2.5} dot={{ r: 3, fill: "#67c1cb" }} activeDot={{ r: 5 }}/></LineChart></ResponsiveContainer></div> : <Empty title="No mileage trend yet" detail="MOT and workshop readings will appear when available." />}
      </section>
      <section className="vault-card overflow-hidden">
        <div className="border-b border-border p-5"><p className="text-xs font-semibold uppercase tracking-wider text-primary">02 / Provenance</p><h2 className="mt-1 text-xl font-bold">Services & workshops</h2></div>
        {passport.services.length ? <ol className="divide-y divide-border">{[...passport.services].sort((a,b) => b.date.localeCompare(a.date)).map((service) => {
          const stamped = service.is_verified_stamp === true;
          const verifiedLabel = stamped ? service.is_sample ? "Sample stamp · not live VAT verified" : "Workshop stamp" : "Owner logged · unverified";
          return <li key={service.id} className="relative min-w-0 p-5 sm:px-6"><div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start"><div className="min-w-0 flex-1"><div className="flex min-w-0 flex-wrap items-center gap-2"><h3 className="min-w-0 break-words font-bold hyphens-auto">{service.description}</h3><Pill tone={stamped && !service.is_sample ? "success" : service.is_sample ? "warning" : "muted"}>{verifiedLabel}</Pill></div><p className="mt-1 break-words text-sm text-muted-foreground hyphens-auto">{fmtDate(service.date)} · {service.garage}</p><p className="mt-1 break-words text-xs text-muted-foreground">{fmtMiles(service.mileage)} · {service.category}</p></div><span className="break-words text-sm font-semibold">{service.cost != null ? `£${service.cost.toFixed(2)}` : "Cost not supplied"}</span></div>
            {service.items.length > 0 && <div className="mt-4 min-w-0 rounded-lg bg-background/40 p-3"><p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Work recorded</p><ul className="min-w-0 space-y-1.5 text-sm">{service.items.map((item, index) => <li key={`${item}-${index}`} className="flex min-w-0 gap-2"><span className="shrink-0 text-primary">—</span><span className="min-w-0 break-words hyphens-auto">{item}</span></li>)}</ul></div>}
            {service.parts && service.parts.length > 0 && <div className="mt-3 min-w-0 space-y-2"><h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Parts Breakdown</h4>{service.parts.map((part, index) => <div key={`${part.name}-${index}`} className="grid min-w-0 gap-1 rounded-lg border border-border bg-background/40 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] sm:items-center"><p className="min-w-0 break-words text-sm hyphens-auto">{part.name}</p><p className="min-w-0 break-all font-mono text-xs text-muted-foreground"><span className="font-sans font-semibold uppercase tracking-wide">Part reference · </span>{part.partNo || "Not recorded"}</p></div>)}</div>}
            <p className="mt-3 text-[11px] text-muted-foreground">Receipt files are not shared on this page.</p>
          </li>;
        })}</ol> : <Empty title="No service records" detail="The keeper has not shared service records for this vehicle." />}
      </section>
      <section className="vault-card overflow-hidden">
        <div className="border-b border-border p-5"><p className="text-xs font-semibold uppercase tracking-wider text-primary">03 / Roadworthiness</p><h2 className="mt-1 text-xl font-bold">MOT record</h2><p className="mt-1 text-xs text-muted-foreground">{passport.vehicle.source === "official" && !passport.is_sample ? "Official-source data supplied to V5Vault" : "Unverified or sample data"}</p></div>
        {passport.mot_history.length ? <div className="divide-y divide-border">{[...passport.mot_history].reverse().map((mot, index) => <div className="flex flex-wrap items-center justify-between gap-3 p-4" key={`${mot.date}-${index}`}><div><p className="font-semibold">{fmtDate(mot.date)}</p><p className="mt-1 text-sm text-muted-foreground">{mot.result}{mot.advisories?.length ? ` · ${mot.advisories.join("; ")}` : ""}</p></div><div className="text-right"><p className="font-mono text-sm">{mot.mileage !== undefined ? fmtMiles(mot.mileage) : "Mileage unavailable"}</p><Pill tone={passport.is_sample ? "warning" : "muted"}>{passport.is_sample ? "Sample" : "Source unverified here"}</Pill></div></div>)}</div> : <Empty title="No MOT history shared" detail="No MOT entries are available in this snapshot." />}
      </section>
      <footer className="rounded-xl border border-warning/30 bg-warning/5 p-4 text-xs leading-relaxed text-muted-foreground"><p className="font-semibold text-warning">Important: not government certification</p><p className="mt-1">V5Vault presents records supplied by keepers, workshops and external sources. A stamp or mileage entry shown here does not independently certify the vehicle, its condition, ownership or roadworthiness. Verify important facts directly before purchase.</p><p className="mt-2">Snapshot generated {new Date(passport.generated_at).toLocaleDateString("en-GB")} · public information only.</p></footer>
    </>}
  </main>;
}
function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="rounded-xl border border-border bg-background/35 p-3"><div className="mb-2 text-primary [&>svg]:h-4 [&>svg]:w-4">{icon}</div><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p><p className="mt-1 text-sm font-bold">{value}</p></div>; }
function Empty({ title, detail }: { title: string; detail: string }) { return <div className="px-5 py-9 text-center"><p className="font-semibold">{title}</p><p className="mt-1 text-sm text-muted-foreground">{detail}</p></div>; }

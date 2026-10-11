import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, Copy, Download, EyeOff, FileBadge, Gauge, Loader2, LockKeyhole, Wrench, Zap } from "lucide-react";
import { toast } from "sonner";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { QRCodeSVG } from "qrcode.react";
import { MOT_READINGS, can, fmtDate, fmtMiles, today, useVault, type Role, type ServiceRecord } from "@/lib/vault-store";
import { PageHeader, Pill, Plate, Thumb } from "@/components/vault/ui-bits";
import { UpgradeDialog } from "@/components/vault/UpgradeDialog";
import { V5VaultLogo } from "@/components/vault/V5VaultLogo";
import { cn } from "@/lib/utils";
import { useAccount } from "@/lib/account-store";
import { VehicleLookupDialog } from "@/components/vault/VehicleLookupDialog";
import { SharePassportModal } from "@/components/vault/SharePassportModal";
import { hasVerifiedVehicleRegistration, REVERIFICATION_NOTICE } from "@/lib/vehicle-verification";

export const Route = createFileRoute("/passport")({
  head: () => ({
    meta: [
      { title: "Export Passport — Tiered Resale Certificates | V5Vault" },
      { name: "description", content: "Download a Standard Passport, OEM Provenance Certificate or Master Build Sheet to prove your car's history at resale." },
      { property: "og:title", content: "Resale Passports — V5Vault" },
      { property: "og:description", content: "Mileage proof, OEM parts provenance and full modification build sheets in one verified export." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PassportPage,
});

type Cert = "standard" | "oem" | "master";

function provenance(s: ServiceRecord) {
  if (s.is_verified_stamp !== true) return "Owner Logged / DIY Record";
  if (s.stamp_authority === "administrator") return `${s.is_sample ? "Development sample · " : ""}Administrator-signed record - ${s.garage} · /verify/${s.id}`;
  if (s.is_sample === true) return `Development sample · VAT not live verified${s.stamp_signature ? ` · Signature ${s.stamp_signature}` : ""} · /verify/${s.id}`;
  return `Verified Workshop Stamp - ${s.garage} (VAT Reg Verified)${s.stamp_signature ? ` · Signature ${s.stamp_signature}` : ""} · /verify/${s.id}`;
}

const CERTS: { id: Cert; title: string; tier: string; price: string; icon: typeof Gauge; includes: string; allowed: (r: Role) => boolean }[] = [
  { id: "standard", title: "Standard Passport", tier: "Basic", price: "Free", icon: Gauge, includes: "Mileage graph, service dates, garage names, official MOT log", allowed: () => true },
  { id: "oem", title: "OEM Provenance Certificate", tier: "Pro DIY", price: "£0.99/mo", icon: Wrench, includes: "Everything in Standard, manufacturer part numbers, receipt thumbnails, parts and labour spend summary", allowed: can.diy },
  { id: "master", title: "Master Build Sheet", tier: "Pro Modder", price: "£1.49/mo", icon: Zap, includes: "Everything in Standard and OEM, active build spec, dyno printouts, specialist stamps, reverted mods", allowed: can.vault },
];

function PassportPage() {
  const { role } = useVault();
  const account = useAccount();
  const [cert, setCert] = useState<Cert | null>(null);
  const [loading, setLoading] = useState<Cert | null>(null);
  const [upsell, setUpsell] = useState<(typeof CERTS)[number] | null>(null);
  const [connectOpen, setConnectOpen] = useState(false);
  const [shareOpen,setShareOpen]=useState(false);
  const {vehicle:activeVehicle}=useVault();
  const registrationVerified=hasVerifiedVehicleRegistration(activeVehicle.verification_state);

  if (account?.signedIn && account.state && account.state.vehicles.length === 0) {
    return <div className="vault-card p-6"><p className="font-mono text-[10px] uppercase tracking-widest text-primary">Your passport</p><h1 className="mt-2 text-2xl font-bold">Connect a vehicle to build its export.</h1><p className="mt-2 text-sm text-muted-foreground">Link a vehicle with your V5C logbook reference before creating a passport.</p><button onClick={() => setConnectOpen(true)} className="btn-primary mt-5">Connect New Vehicle</button><VehicleLookupDialog open={connectOpen} onOpenChange={setConnectOpen} /></div>;
  }

  function open(c: (typeof CERTS)[number]) {
    if (!c.allowed(role)) return setUpsell(c);
    setLoading(c.id);
    setTimeout(() => {
      setLoading(null);
      setCert(c.id);
    }, 1000);
  }

  return (
    <div className="space-y-5">
      <div className="print:hidden"><PageHeader title="Export Passport" subtitle="Resale certificates that document your vehicle history." /></div>
      {!registrationVerified&&<div role="alert" className="rounded-xl border border-amber-400/30 bg-amber-950/20 p-4 text-sm leading-relaxed text-amber-100">{REVERIFICATION_NOTICE}<p className="mt-2 text-xs text-amber-100/70">Your timeline remains available, but public sharing and certified sales-pack exports stay locked until verification is complete.</p></div>}
      <button className="btn-primary w-full print:hidden" onClick={()=>setShareOpen(true)} disabled={!registrationVerified}><FileBadge className="h-4 w-4"/>{registrationVerified?"Sales pack & shareable buyer passport":"Re-verification required to share or export"}</button>
      <SharePassportModal open={shareOpen} onOpenChange={setShareOpen} vrm={activeVehicle.vrm}/>
      <div className="space-y-3 print:hidden">
        {CERTS.map((c) => {
          const ok = c.allowed(role);
          const Icon = c.icon;
          return (
            <button
              key={c.id}
              onClick={() => open(c)}
              className={cn("vault-card flex w-full items-start gap-3 p-4 text-left transition", cert === c.id && "ring-2 ring-primary", !ok && "opacity-75")}
            >
              <span className={cn("rounded-lg p-2", ok ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>
                {loading === c.id ? <Loader2 className="h-5 w-5 animate-spin" /> : <Icon className="h-5 w-5" />}
              </span>
              <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2 break-words font-bold hyphens-auto">
                  {c.title}
                  <Pill tone={ok ? "primary" : "muted"}>{c.tier}</Pill>
                </span>
                <span className="mt-1 block break-words text-xs text-muted-foreground hyphens-auto">{c.includes}</span>
              </span>
              {ok ? <FileBadge className="h-5 w-5 shrink-0 text-primary" /> : <LockKeyhole className="h-5 w-5 shrink-0 text-muted-foreground" />}
            </button>
          );
        })}
      </div>

      {cert && CERTS.find((c) => c.id === cert)!.allowed(role) && <Certificate key={cert} cert={cert} />}

      <UpgradeDialog
        open={!!upsell}
        onOpenChange={(o) => !o && setUpsell(null)}
        tier={upsell?.tier ?? ""}
        price={upsell?.price ?? ""}
        perks={upsell ? upsell.includes.split(", ") : []}
      />
    </div>
  );
}

function Certificate({ cert }: { cert: Cert }) {
  const { vehicle, services, mods } = useVault();
  const motReadings = vehicle.motHistory ?? (vehicle.source==="demo"?MOT_READINGS:[]);
  const meta = CERTS.find((c) => c.id === cert)!;
  const history = useMemo(() => services.filter((s) => s.vrm === vehicle.vrm).sort((a, b) => b.date.localeCompare(a.date)), [services, vehicle.vrm]);
  const vMods = mods.filter((m) => m.vrm === vehicle.vrm);
  const active = vMods.filter((m) => m.status === "active");
  const reverted = vMods.filter((m) => m.status === "reverted");
  const reportId = `${vehicle.vrm}-${cert.toUpperCase()}-${(history.length * 7919 + vMods.length * 131 + 4127).toString(36).toUpperCase()}`;
  const signedRecord = history.find(s=>s.is_verified_stamp === true && s.stamp_signature);
  const link = signedRecord ? `${typeof window !== "undefined" ? window.location.origin : ""}/verify/${signedRecord.id}` : "";
  const sampleDocument = vehicle.source === "demo" || vehicle.is_sample === true;
  const total = history.reduce((a, s) => a + (s.cost ?? 0), 0);
  const partsTotal = history.reduce((a, s) => a + (s.partsCost ?? 0), 0);
  const labourTotal = history.reduce((a, s) => a + (s.labourCost ?? 0), 0);
  const chart = useMemo(
    () =>
      [...motReadings.filter((r) => r.mileage !== undefined).map((r) => ({ date: r.date, mileage: r.mileage!, src: vehicle.source === "official" ? "Official MOT" : "Sample MOT" })), ...history.map((h) => ({ date: h.date, mileage: h.mileage, src: h.garage }))]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((p) => ({ ...p, t: new Date(p.date).getTime() })),
    [history, motReadings, vehicle.source],
  );

  return (
    <div className="min-w-0 animate-vault-open">
      <div className="passport-document min-w-0">
        <div className="relative z-10 space-y-5">
          <header className="passport-section min-w-0 space-y-4 p-5">
            <div className="flex min-w-0 flex-col gap-2 border-b border-slate-300 pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-2 break-words text-xs font-bold uppercase tracking-[0.18em] text-slate-600">
                <V5VaultLogo className="h-4 w-4" /> V5Vault · UK Vehicle Records
              </div>
              <Pill tone={sampleDocument ? "warning" : signedRecord ? "success" : "muted"}>
                <BadgeCheck className="h-3 w-3" /> {sampleDocument ? "Development sample document" : signedRecord ? "Contains signed workshop records" : "Owner-logged document"}
              </Pill>
            </div>
            <div className="flex flex-wrap gap-2">
              <Pill tone={vehicle.verification_tier === "government_data" ? "success" : vehicle.verification_tier === "workshop_checked" ? "primary" : "muted"}>
                {vehicle.verification_tier === "government_data" ? "Government data matched" : vehicle.verification_tier === "workshop_checked" ? "Workshop checked" : "Provisional vehicle data"}
              </Pill>
              {vehicle.is_scrapped && <Pill tone="warning">Scrapped · passport read-only</Pill>}
            </div>
            {vehicle.is_scrapped && <p className="rounded-lg border border-amber-500/25 bg-amber-950/20 p-3 text-xs leading-relaxed text-amber-900 print:text-amber-950">This vehicle is marked as scrapped. This certificate preserves its history; no new workshop or owner service records can be added.</p>}
            <div className="flex items-center justify-between gap-2">
              <Plate vrm={vehicle.vrm} />
            </div>
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">{meta.title}</p>
                <h2 className="break-words text-xl font-bold hyphens-auto">
                  {vehicle.make} {vehicle.model}
                </h2>
                <p className="break-words text-xs text-muted-foreground">Certificate {reportId} · issued {fmtDate(today())}</p>
              </div>
              <aside className="flex w-full max-w-full flex-col items-center rounded-md border-2 border-slate-950 bg-white p-2 text-center text-slate-950 sm:w-fit">
                {link ? <><QRCodeSVG className="h-auto max-w-full" value={link} size={90} level="H" includeMargin /><p className="max-w-full break-words text-[9px] font-extrabold leading-tight">Scan to Verify Authenticity</p><p className="mt-1 max-w-full break-words text-[8px]">Latest workshop stamp</p></> : <p className="flex min-h-[90px] w-full max-w-full items-center justify-center break-words text-[10px] font-semibold">No signed workshop stamp to verify</p>}
              </aside>
            </div>
            <div className="flex min-w-0 flex-col gap-2 print:hidden sm:flex-row">
              <code className="field min-w-0 flex-1 truncate text-xs">{link || "No signed workshop record"}</code>
              <button
                disabled={!link}
                onClick={() => {
                  navigator.clipboard?.writeText(link);
                  toast.success("Share link copied");
                }}
                className="btn-ghost shrink-0"
                aria-label="Copy share link"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
            <button onClick={() => window.print()} className="btn-primary w-full print:hidden">
              <Download className="h-4 w-4" /> Download PDF
            </button>
          </header>

      {(
        <>
          <section className="passport-section p-4">
            <h3 className="mb-1 font-bold">DVLA Mileage Progression</h3>
            <p className="mb-3 text-xs text-muted-foreground">MOT readings and logged records · {vehicle.source === "official" ? "official API lookup" : "sample MOT data"}.</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart} margin={{ left: -10, right: 8, top: 5 }}>
                  <CartesianGrid stroke="#cbd5e1" vertical={false} />
                  <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={(t) => new Date(t).getFullYear().toString()} stroke="#475569" fontSize={11} />
                  <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} stroke="#475569" fontSize={11} domain={["dataMin - 3000", "dataMax + 2000"]} />
                  <Tooltip
                    contentStyle={{ background: "#fff", color: "#0f172a", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 12 }}
                    labelFormatter={(t) => new Date(t as number).toLocaleDateString("en-GB")}
                    formatter={(v: number, _n, p) => [fmtMiles(v), (p.payload as { src: string }).src]}
                  />
                  <Line type="monotone" dataKey="mileage" stroke="#0e7490" strokeWidth={2.5} dot={{ r: 3, fill: "#0e7490" }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
          {history.length > 0
            ? <RecordCards
                title="Service History"
                rows={history.map((s) => ({
                  key: s.id,
                  title: s.category || "Service record",
                  date: fmtDate(s.date),
                  provider: s.garage,
                  badge: fmtMiles(s.mileage),
                  summaryLabel: "Work summary",
                  summary: s.description,
                  details: [{ label: "Record provenance", value: provenance(s) }],
                }))}
                empty="No service records."
              />
            : <section className="passport-section min-w-0 p-4" aria-label="Service History">
                <h3 className="mb-3 font-bold">Service History</h3>
                <div role="status" className="inline-flex max-w-full flex-nowrap items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-300 bg-slate-100 px-3.5 py-2.5 text-[11px] font-semibold text-slate-800">
                  <span>📄 No Service Records</span><span aria-hidden="true" className="text-slate-500">·</span><span>💰 Recorded Spend: £0.00</span>
                </div>
              </section>}
          <RecordCards
            title={vehicle.source === "official" ? "Official MOT & Mileage Log" : "Sample MOT & Mileage Log"}
            rows={[...motReadings].reverse().map((m, index) => ({
              key: `${m.date}-${index}`,
              title: "MOT test",
              date: fmtDate(m.date),
              provider: vehicle.source === "official" ? "Official MOT record" : "Sample MOT record",
              badge: m.mileage !== undefined ? fmtMiles(m.mileage) : undefined,
              summaryLabel: "Result",
              summary: m.result,
              details: m.advisories?.length ? [{ label: "Advisories", value: m.advisories.join("; ") }] : [],
            }))}
            empty="No MOT history available."
          />
          <div className="print:hidden"><RedactionPreview vrm={vehicle.vrm} /></div>
        </>
      )}

      {(cert === "oem" || cert === "master") && (
        <>
          {history.length > 0 && <section className="passport-section min-w-0 p-4" aria-labelledby="financial-summary-title">
            <h3 id="financial-summary-title" className="mb-3 font-bold">Financial Summary</h3>
            <div className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-3">
            {[
              ["Total Spend", total],
              ["Parts", partsTotal],
              ["Labour", labourTotal],
            ].map(([l, v]) => (
              <div key={l as string} className="min-w-0 rounded-lg border border-slate-200 bg-white/80 p-3">
                <p className="break-words text-xs text-muted-foreground">{l}</p>
                <p className="break-words font-display text-lg font-bold">£{(v as number).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            ))}
            </div>
          </section>}
          {history.map((s) => (
            <section key={s.id} className="passport-section passport-service-record min-w-0 p-4">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <p className="break-words text-xs text-muted-foreground">
                    {s.category || "Service record"} · {fmtDate(s.date)}
                  </p>
                  <p className="mt-1 break-words text-sm text-muted-foreground">{s.garage} · {fmtMiles(s.mileage)}</p>
                  <h3 className="passport-service-description mt-2 break-words font-bold hyphens-auto">{s.description}</h3>
                  {s.fluids && <p className="break-words text-xs text-muted-foreground hyphens-auto">Fluids: {s.fluids}</p>}
                </div>
                {s.image && <div className="passport-receipt-image max-w-full self-start"><Thumb src={s.image} alt={`${s.description} receipt`} /></div>}
              </div>
              <div className="mt-3 min-w-0">
                <h4 className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-600">Parts Breakdown</h4>
                <div className="space-y-2">
                  {(s.parts ?? []).map((p, i) => (
                    <div key={`${p.name}-${i}`} className="passport-part-card grid min-w-0 gap-1 rounded-lg border border-slate-200 bg-white/80 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] sm:items-center">
                      <p className="min-w-0 break-words text-sm hyphens-auto">{p.name}</p>
                      <p className="min-w-0 break-all font-mono text-xs">
                        <span className="font-sans text-[10px] font-semibold uppercase tracking-wide text-slate-500">Manufacturer reference · </span>
                        {p.partNo || "—"}
                      </p>
                    </div>
                  ))}
                  {!s.parts?.length && <p className="rounded-lg bg-white/80 p-3 text-sm text-slate-500">No part numbers logged.</p>}
                </div>
                <div className="passport-cost-breakdown mt-3 grid min-w-0 grid-cols-1 gap-2 min-[360px]:grid-cols-3" role="group" aria-label="Itemized costs">
                  {[
                    ["Parts", s.partsCost ?? 0],
                    ["Labour", s.labourCost ?? 0],
                    ["Total", s.cost ?? 0],
                  ].map(([label, amount]) => (
                    <div key={label as string} className="passport-cost-card min-w-0 rounded-lg border border-slate-200 bg-white/80 p-2">
                      <p className="break-words text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                      <p className="break-words font-mono text-sm font-bold">£{(amount as number).toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </>
      )}

      {cert === "master" && (
        <>
          <section>
            <h3 className="mb-3 font-bold">Active Build Spec</h3>
            <div className="space-y-3">
              {active.map((m) => (
                <div key={m.id} className="passport-section p-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap gap-1.5">
                        <Pill tone="primary">{m.category}</Pill>
                        {m.stage && <Pill tone="success">{m.stage}</Pill>}
                      </div>
                      <p className="mt-1 font-bold">{m.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Fitted {fmtDate(m.installDate)} @ {fmtMiles(m.installMileage)}
                      </p>
                      {m.gains && <p className="font-display text-sm font-bold text-success">{m.gains}</p>}
                      {m.specs && <p className="mt-1 text-sm">{m.specs}</p>}
                    </div>
                  </div>
                  {m.image && (
                    <div className="passport-dyno-image mt-3">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dyno Curve Printout</p>
                      <img src={m.image} alt={`${m.name} dyno curve`} className="passport-dyno-photo w-full rounded-lg border" />
                    </div>
                  )}
                  {m.tags && m.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {m.tags.map((t) => (
                        <Pill key={t}>
                          <BadgeCheck className="h-3 w-3" /> {t}
                        </Pill>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {active.length === 0 && <p className="text-sm text-muted-foreground">Vehicle is running stock.</p>}
            </div>
          </section>
          <RecordCards
            title="Specialist Stamps"
            rows={history.filter((s) => s.is_verified_stamp === true).map((s) => ({
              key: s.id,
              title: "Specialist workshop stamp",
              date: fmtDate(s.date),
              provider: s.garage,
              badge: fmtMiles(s.mileage),
              summaryLabel: "Stamp details",
              summary: provenance(s),
            }))}
            empty="No specialist stamps yet."
          />
          <RecordCards
            title="Reverted / Removed Modifications"
            rows={reverted.map((m) => ({
              key: m.id,
              title: m.name,
              date: m.removalDate ? fmtDate(m.removalDate) : undefined,
              provider: "Modification history",
              badge: `${fmtMiles(m.installMileage)} → ${fmtMiles(m.removalMileage ?? 0)}`,
              summaryLabel: "Status",
              summary: "Removed / reverted",
            }))}
            empty="No modifications reverted."
          />
        </>
      )}
        </div>
      </div>
    </div>
  );
}

type PassportCardRow = {
  key: string;
  title: string;
  date?: string | undefined;
  provider?: string;
  badge?: string | undefined;
  summaryLabel?: string;
  summary?: string;
  details?: { label: string; value: string }[];
};

function RecordCards({ title, rows, empty }: { title: string; rows: PassportCardRow[]; empty: string }) {
  return (
    <section className="passport-section passport-record-section min-w-0 p-4">
      <h3 className="mb-2 font-bold">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="passport-record-list min-w-0 space-y-2" role="list">
          {rows.map((row) => (
            <article key={row.key} className="passport-record-card min-w-0 rounded-xl border border-slate-200 bg-white/80 p-3" role="listitem">
              <div className="flex min-w-0 flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <h4 className="break-words font-bold hyphens-auto">{row.title}</h4>
                  {row.date && <p className="mt-0.5 break-words text-xs text-slate-600">{row.date}</p>}
                </div>
                {row.badge && <span className="max-w-full self-start break-words rounded-full border border-cyan-800/20 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-900">{row.badge}</span>}
              </div>
              {row.provider && <p className="mt-2 min-w-0 break-words text-sm text-slate-700 hyphens-auto">{row.provider}</p>}
              {row.summary && (
                <div className="mt-2 min-w-0 border-t border-slate-200 pt-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{row.summaryLabel ?? "Details"}</p>
                  <p className="mt-0.5 min-w-0 break-words text-sm text-slate-800 hyphens-auto">{row.summary}</p>
                </div>
              )}
              {row.details?.map((detail) => (
                <div key={detail.label} className="mt-2 min-w-0 rounded-lg bg-slate-50 p-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{detail.label}</p>
                  <p className="mt-0.5 min-w-0 break-words text-xs text-slate-700 hyphens-auto">{detail.value}</p>
                </div>
              ))}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function Redact({ children, delay }: { children: string; delay: number }) {
  return (
    <span className="relative inline-block">
      <span className="invisible">{children}</span>
      <span className="absolute inset-0 animate-redact rounded-sm bg-redact" style={{ animationDelay: `${delay}ms` }} aria-label="Redacted" />
    </span>
  );
}

function RedactionPreview({ vrm }: { vrm: string }) {
  return (
    <section className="passport-section p-4">
      <h3 className="flex items-center gap-2 font-bold">
        <EyeOff className="h-4 w-4 text-primary" /> Automatic PII Redaction
      </h3>
      <p className="mb-3 text-xs text-muted-foreground">Names, addresses and phone numbers are permanently blacked out before sharing.</p>
      <div className="rotate-[-0.6deg] rounded-md bg-foreground p-4 font-mono text-[11px] leading-relaxed text-background shadow-lg">
        <div className="flex justify-between border-b border-background/20 pb-2">
          <span className="font-bold">APEX PERFORMANCE LTD</span>
          <span>INV #20431</span>
        </div>
        <div className="mt-2 space-y-0.5">
          <p>
            Customer: <Redact delay={200}>Mr James Davies</Redact>
          </p>
          <p>
            Address: <Redact delay={400}>14 Larkspur Close, Harrogate</Redact>
          </p>
          <p>
            Tel: <Redact delay={600}>07700 900461</Redact>
          </p>
          <p>Vehicle: {vrm.slice(0, 4)} {vrm.slice(4)} · Audi A4</p>
        </div>
        <div className="mt-2 space-y-0.5 border-t border-background/20 pt-2">
          <p className="flex justify-between"><span>Brembo discs (pr)</span><span>£284.00</span></p>
          <p className="flex justify-between"><span>Brembo pads</span><span>£118.00</span></p>
          <p className="flex justify-between"><span>Labour 2.0h</span><span>£240.00</span></p>
          <p className="flex justify-between font-bold"><span>TOTAL</span><span>£642.00</span></p>
        </div>
      </div>
    </section>
  );
}

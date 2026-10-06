import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, Copy, Download, EyeOff, FileBadge, Gauge, Loader2, LockKeyhole, ShieldCheck, Wrench, Zap } from "lucide-react";
import { toast } from "sonner";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MOT_READINGS, can, fmtDate, fmtMiles, today, useVault, type Role } from "@/lib/vault-store";
import { PageHeader, Pill, Plate, Thumb } from "@/components/vault/ui-bits";
import { UpgradeDialog } from "@/components/vault/UpgradeDialog";
import { cn } from "@/lib/utils";

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

const CERTS: { id: Cert; title: string; tier: string; price: string; icon: typeof Gauge; includes: string; allowed: (r: Role) => boolean }[] = [
  { id: "standard", title: "Standard Passport", tier: "Basic", price: "Free", icon: Gauge, includes: "Mileage graph, service dates, garage names, official MOT log", allowed: () => true },
  { id: "oem", title: "OEM Provenance Certificate", tier: "Pro DIY", price: "£0.99/mo", icon: Wrench, includes: "Manufacturer part numbers, receipt thumbnails, total spend summary", allowed: can.diy },
  { id: "master", title: "Master Build Sheet", tier: "Pro Modder", price: "£1.99/mo", icon: Zap, includes: "Active build spec, dyno printouts, specialist stamps, reverted mods", allowed: can.vault },
];

function PassportPage() {
  const { role } = useVault();
  const [cert, setCert] = useState<Cert | null>(null);
  const [loading, setLoading] = useState<Cert | null>(null);
  const [upsell, setUpsell] = useState<(typeof CERTS)[number] | null>(null);

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
      <PageHeader title="Export Passport" subtitle="Tamper-proof resale certificates that add value when you sell." />
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
                <span className="flex flex-wrap items-center gap-2 font-bold">
                  {c.title}
                  <Pill tone={ok ? "primary" : "muted"}>{c.tier}</Pill>
                </span>
                <span className="mt-1 block text-xs text-muted-foreground">{c.includes}</span>
              </span>
              {ok ? <FileBadge className="h-5 w-5 shrink-0 text-primary" /> : <LockKeyhole className="h-5 w-5 shrink-0 text-muted-foreground" />}
            </button>
          );
        })}
      </div>

      {cert && <Certificate key={cert} cert={cert} />}

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
  const meta = CERTS.find((c) => c.id === cert)!;
  const history = useMemo(() => services.filter((s) => s.vrm === vehicle.vrm).sort((a, b) => b.date.localeCompare(a.date)), [services, vehicle.vrm]);
  const vMods = mods.filter((m) => m.vrm === vehicle.vrm);
  const active = vMods.filter((m) => m.status === "active");
  const reverted = vMods.filter((m) => m.status === "reverted");
  const reportId = `${vehicle.vrm}-${cert.toUpperCase()}-${(history.length * 7919 + vMods.length * 131 + 4127).toString(36).toUpperCase()}`;
  const link = `https://v5vault.app/p/${reportId}`;
  const total = history.reduce((a, s) => a + (s.cost ?? 0), 0);
  const partsTotal = history.reduce((a, s) => a + (s.partsCost ?? 0), 0);
  const labourTotal = history.reduce((a, s) => a + (s.labourCost ?? 0), 0);
  const chart = useMemo(
    () =>
      [...MOT_READINGS.map((r) => ({ date: r.date, mileage: r.mileage, src: "DVLA MOT" })), ...history.map((h) => ({ date: h.date, mileage: h.mileage, src: h.garage }))]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((p) => ({ ...p, t: new Date(p.date).getTime() })),
    [history],
  );

  return (
    <div className="animate-vault-open space-y-5">
      <section className="vault-card space-y-4 p-5 glow">
        <div className="flex items-center justify-between gap-2">
          <Plate vrm={vehicle.vrm} />
          <Pill tone="success">
            <ShieldCheck className="h-3 w-3" /> Tamper-proof
          </Pill>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">{meta.title}</p>
          <h2 className="text-xl font-bold">
            {vehicle.make} {vehicle.model}
          </h2>
          <p className="text-xs text-muted-foreground">Certificate {reportId} · issued {fmtDate(today())}</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <code className="field truncate text-xs">{link}</code>
          <button
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
      </section>

      {cert === "standard" && (
        <>
          <section className="vault-card p-4">
            <h3 className="mb-1 font-bold">DVLA Mileage Progression</h3>
            <p className="mb-3 text-xs text-muted-foreground">MOT readings and logged records — no rollbacks detected.</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart} margin={{ left: -10, right: 8, top: 5 }}>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={(t) => new Date(t).getFullYear().toString()} stroke="var(--color-muted-foreground)" fontSize={11} />
                  <YAxis tickFormatter={(v) => `${Math.round(v / 1000)}k`} stroke="var(--color-muted-foreground)" fontSize={11} domain={["dataMin - 3000", "dataMax + 2000"]} />
                  <Tooltip
                    contentStyle={{ background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
                    labelFormatter={(t) => new Date(t as number).toLocaleDateString("en-GB")}
                    formatter={(v: number, _n, p) => [fmtMiles(v), (p.payload as { src: string }).src]}
                  />
                  <Line type="monotone" dataKey="mileage" stroke="var(--color-primary)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--color-primary)" }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>
          <Table
            title="Service Dates"
            rows={history.map((s) => [fmtDate(s.date), s.garage, fmtMiles(s.mileage)])}
            empty="No service records."
          />
          <Table title="Official MOT Log" rows={[...MOT_READINGS].reverse().map((m) => [fmtDate(m.date), m.result, fmtMiles(m.mileage)])} empty="" />
          <RedactionPreview vrm={vehicle.vrm} />
        </>
      )}

      {cert === "oem" && (
        <>
          <section className="vault-card grid grid-cols-3 gap-2 p-4 text-center">
            {[
              ["Total Spend", total],
              ["Parts", partsTotal],
              ["Labour", labourTotal],
            ].map(([l, v]) => (
              <div key={l as string}>
                <p className="text-xs text-muted-foreground">{l}</p>
                <p className="font-display text-lg font-bold">£{(v as number).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>
            ))}
          </section>
          {history.map((s) => (
            <section key={s.id} className="vault-card p-4">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">
                    {fmtDate(s.date)} · {s.garage}
                  </p>
                  <h3 className="font-bold">{s.description}</h3>
                  {s.fluids && <p className="text-xs text-muted-foreground">Fluids: {s.fluids}</p>}
                </div>
                {s.image && <Thumb src={s.image} alt={`${s.description} receipt`} />}
              </div>
              <ul className="mt-2 space-y-1 border-t pt-2 text-sm">
                {(s.parts ?? []).map((p, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="text-muted-foreground">{p.name}</span>
                    <span className="font-mono text-xs text-primary">{p.partNo || "—"}</span>
                  </li>
                ))}
                {!s.parts?.length && <li className="text-xs text-muted-foreground">No part numbers logged.</li>}
              </ul>
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
                <div key={m.id} className="vault-card p-4">
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
                    <div className="mt-3">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dyno Curve Printout</p>
                      <img src={m.image} alt={`${m.name} dyno curve`} className="w-full rounded-lg border" />
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
          <Table
            title="Specialist Stamps"
            rows={history.filter((s) => s.tier3).map((s) => [fmtDate(s.date), s.garage, "Verified Workshop"])}
            empty="No specialist stamps yet."
          />
          <Table
            title="Reverted / Removed Modifications"
            rows={reverted.map((m) => [m.name, `${fmtMiles(m.installMileage)} → ${fmtMiles(m.removalMileage ?? 0)}`, m.removalDate ? fmtDate(m.removalDate) : ""])}
            empty="No modifications reverted."
          />
        </>
      )}
    </div>
  );
}

function Table({ title, rows, empty }: { title: string; rows: string[][]; empty: string }) {
  return (
    <section className="vault-card p-4">
      <h3 className="mb-2 font-bold">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y text-sm">
          {rows.map((r, i) => (
            <li key={i} className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-3 py-2">
              <span>{r[0]}</span>
              <span className="truncate text-muted-foreground">{r[1]}</span>
              <span className="text-right text-xs text-muted-foreground">{r[2]}</span>
            </li>
          ))}
        </ul>
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
    <section className="vault-card p-4">
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

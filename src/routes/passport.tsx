import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Copy, EyeOff, FileBadge, Loader2, ShieldCheck, Zap } from "lucide-react";
import { toast } from "sonner";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtDate, fmtMiles, useVault } from "@/lib/vault-store";
import { PageHeader, Pill, Plate, ShieldLogo } from "@/components/vault/ui-bits";
import { TimelineItem } from "@/components/vault/TimelineItem";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/passport")({
  head: () => ({
    meta: [
      { title: "Export Passport — Verified Buyer Report | V5Vault" },
      { name: "description", content: "Generate a tamper-proof vehicle passport with mileage history, service timeline and automatic personal data redaction." },
      { property: "og:title", content: "Verified Buyer Passport — V5Vault" },
      { property: "og:description", content: "Sell with proof: mileage curve, full service history and modifications in one shareable link." },
    ],
  }),
  component: PassportPage,
});

// Mock DVLA MOT odometer readings
const MOT_READINGS = [
  { date: "2018-11-14", mileage: 48210 },
  { date: "2019-11-12", mileage: 56980 },
  { date: "2020-11-20", mileage: 62340 },
  { date: "2021-11-18", mileage: 69110 },
  { date: "2022-11-16", mileage: 75020 },
  { date: "2023-11-15", mileage: 80480 },
  { date: "2025-11-18", mileage: 86900 },
];

function PassportPage() {
  const { vehicle, services, mods } = useVault();
  const [state, setState] = useState<"idle" | "loading" | "ready">("idle");
  const [mode, setMode] = useState<"standard" | "full">("standard");

  const history = useMemo(() => services.filter((s) => s.vrm === vehicle.vrm).sort((a, b) => b.date.localeCompare(a.date)), [services, vehicle.vrm]);
  const active = mods.filter((m) => m.vrm === vehicle.vrm && m.status === "active");
  const chart = useMemo(
    () =>
      [...MOT_READINGS.map((r) => ({ ...r, src: "DVLA MOT" })), ...history.map((h) => ({ date: h.date, mileage: h.mileage, src: h.garage }))]
        .sort((a, b) => a.date.localeCompare(b.date))
        .map((p) => ({ ...p, t: new Date(p.date).getTime() })),
    [history],
  );
  const reportId = useMemo(() => `${vehicle.vrm}-${(history.length * 7919 + 4127).toString(36).toUpperCase()}`, [vehicle.vrm, history.length]);
  const link = `https://v5vault.app/p/${reportId}${mode === "full" ? "?vault=full" : ""}`;

  function generate() {
    setState("loading");
    setTimeout(() => setState("ready"), 1200);
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Export Passport" subtitle="A tamper-proof buyer report that adds value at resale." />

      {state !== "ready" && (
        <div className="vault-card p-6 text-center">
          <ShieldLogo className="mx-auto h-14 w-14 animate-shield" />
          <p className="mx-auto mt-3 max-w-xs text-sm text-muted-foreground">
            Bundles mileage history, {history.length} service records{active.length ? ` and ${active.length} modification${active.length > 1 ? "s" : ""}` : ""} into one verified report.
          </p>
          <button onClick={generate} disabled={state === "loading"} className="btn-primary mt-5 w-full py-4">
            {state === "loading" ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileBadge className="h-5 w-5" />}
            {state === "loading" ? "Signing report…" : "Generate Verified Buyer Passport"}
          </button>
        </div>
      )}

      {state === "ready" && (
        <div className="animate-vault-open space-y-5">
          <section className="vault-card space-y-4 p-5 glow">
            <div className="flex items-center justify-between">
              <Plate vrm={vehicle.vrm} />
              <Pill tone="success">
                <ShieldCheck className="h-3 w-3" /> Tamper-proof
              </Pill>
            </div>
            <div>
              <h2 className="text-xl font-bold">
                {vehicle.make} {vehicle.model}
              </h2>
              <p className="text-xs text-muted-foreground">Report {reportId} · issued {fmtDate(new Date().toISOString().slice(0, 10))}</p>
            </div>

            <div className="grid grid-cols-2 rounded-xl border bg-background/50 p-1">
              {(
                [
                  ["standard", "Standard Link"],
                  ["full", "Full Vault Link"],
                ] as const
              ).map(([k, label]) => (
                <button
                  key={k}
                  onClick={() => setMode(k)}
                  className={cn("rounded-lg py-2 text-sm font-semibold transition-all", mode === k ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {mode === "standard" ? "Routine maintenance only — for dealers and insurers." : "Maintenance plus active modifications — for enthusiast buyers."}
            </p>
            <div className="flex gap-2">
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
          </section>

          <section className="vault-card p-4">
            <h3 className="mb-1 font-bold">DVLA Mileage Progression</h3>
            <p className="mb-3 text-xs text-muted-foreground">MOT readings and verified records — no rollbacks detected.</p>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chart} margin={{ left: -10, right: 8, top: 5 }}>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="t"
                    type="number"
                    scale="time"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={(t) => new Date(t).getFullYear().toString()}
                    stroke="var(--color-muted-foreground)"
                    fontSize={11}
                  />
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

          {mode === "full" && (
            <section className="animate-vault-open">
              <h3 className="mb-3 font-bold">Active Modifications</h3>
              <div className="space-y-2">
                {active.map((m) => (
                  <div key={m.id} className="vault-card flex items-center justify-between gap-3 p-3">
                    <div>
                      <p className="font-semibold">{m.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {m.category} · fitted @ {fmtMiles(m.installMileage)}
                      </p>
                    </div>
                    {m.gains && (
                      <Pill tone="success">
                        <Zap className="h-3 w-3" /> {m.gains}
                      </Pill>
                    )}
                  </div>
                ))}
                {active.length === 0 && <p className="text-sm text-muted-foreground">Vehicle is running stock.</p>}
              </div>
            </section>
          )}

          <section>
            <h3 className="mb-3 font-bold">Itemised Service Timeline</h3>
            <ol className="relative space-y-4 border-l border-primary/30 pl-5">
              {history.map((s) => (
                <TimelineItem key={s.id} s={s} />
              ))}
            </ol>
          </section>

          <RedactionPreview vrm={vehicle.vrm} />
        </div>
      )}
    </div>
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

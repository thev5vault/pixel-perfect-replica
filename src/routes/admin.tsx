import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { BadgeCheck, Car, PoundSterling, ShieldCheck, Users, X } from "lucide-react";
import { toast } from "sonner";
import { formatVrm, useVault } from "@/lib/vault-store";
import { FeatureLock } from "@/components/vault/FeatureLock";
import { Field, PageHeader } from "@/components/vault/ui-bits";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Console — V5Vault" },
      { name: "description", content: "Founder console for V5Vault platform metrics, garage verification and VRM overrides." },
      { property: "og:title", content: "Admin Console — V5Vault" },
      { property: "og:description", content: "Platform metrics, garage approvals and VRM overrides." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const { role } = useVault();
  if (role !== "superadmin") return <FeatureLock feature="garage" />;
  return <AdminConsole />;
}

const QUEUE = [
  { id: "g1", name: "Torque Tuning Ltd", town: "Birmingham", fca: "VAT GB 284 1192 07" },
  { id: "g2", name: "Northside Motors", town: "Leeds", fca: "VAT GB 551 0938 12" },
  { id: "g3", name: "Stage One Garage", town: "Bristol", fca: "VAT GB 730 4471 66" },
];

function AdminConsole() {
  const [queue, setQueue] = useState(QUEUE);
  const [vrm, setVrm] = useState("");
  const [action, setAction] = useState("Force unlink owner");

  const decide = (id: string, ok: boolean) => {
    const g = queue.find((q) => q.id === id);
    setQueue((q) => q.filter((x) => x.id !== id));
    toast[ok ? "success" : "info"](`${g?.name} ${ok ? "approved as Verified Workshop" : "rejected"}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Admin Console" subtitle="Dev Owner / Founder access" />
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Metric icon={<Car className="h-5 w-5" />} label="Registered Vehicles" value="1,248" />
        <Metric icon={<Users className="h-5 w-5" />} label="Pro Modders" value="342" />
        <Metric icon={<PoundSterling className="h-5 w-5" />} label="Monthly Revenue" value="£3,842" />
      </section>

      <section className="vault-card p-4">
        <h2 className="mb-3 flex items-center gap-2 font-bold"><BadgeCheck className="h-5 w-5 text-primary" /> Garage Verification Queue</h2>
        <ul className="space-y-3">
          {queue.map((g) => (
            <li key={g.id} className="flex items-center gap-3 rounded-lg border bg-background/50 p-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{g.name}</p>
                <p className="text-xs text-muted-foreground">{g.town} · {g.fca}</p>
              </div>
              <button onClick={() => decide(g.id, false)} className="btn-ghost px-2" aria-label={`Reject ${g.name}`}><X className="h-4 w-4" /></button>
              <button onClick={() => decide(g.id, true)} className="btn-primary px-3 py-2 text-sm">Approve</button>
            </li>
          ))}
          {queue.length === 0 && <p className="text-sm text-muted-foreground">Queue clear.</p>}
        </ul>
      </section>

      <form
        className="vault-card space-y-4 p-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (vrm.replace(/\s/g, "").length < 2) { toast.error("Enter a valid VRM."); return; }
          toast.success(`${action} applied to ${vrm}`);
          setVrm("");
        }}
      >
        <h2 className="flex items-center gap-2 font-bold"><ShieldCheck className="h-5 w-5 text-primary" /> VRM Override Tool</h2>
        <Field label="Registration">
          <input value={vrm} onChange={(e) => setVrm(formatVrm(e.target.value).slice(0, 8))} placeholder="AB14 CDE" className="field uppercase" />
        </Field>
        <Field label="Action">
          <select value={action} onChange={(e) => setAction(e.target.value)} className="field">
            <option>Force unlink owner</option>
            <option>Reset V5C reference</option>
            <option>Freeze vehicle record</option>
            <option>Restore verified status</option>
          </select>
        </Field>
        <button type="submit" className="btn-primary w-full">Apply Override</button>
      </form>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="vault-card flex items-center gap-3 p-4">
      <div className="rounded-lg bg-primary/15 p-2 text-primary">{icon}</div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="font-display text-2xl font-bold">{value}</p>
      </div>
    </div>
  );
}

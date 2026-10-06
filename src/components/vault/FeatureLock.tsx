import { BadgeCheck, LockKeyhole, Wrench, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type LockedFeature = "vault" | "garage";

const copy = {
  vault: {
    title: "Pro Vault locked",
    description: "Keep every remap, performance part and reversal in one verified build history.",
    action: "Upgrade to Pro Vault (£1.99/mo) to track remaps and mods",
  },
  garage: {
    title: "Specialist Access Only",
    description: "Verify your garage account (£7.99/mo) to stamp customer records.",
    action: "Verify garage account (£7.99/mo)",
  },
} satisfies Record<LockedFeature, { title: string; description: string; action: string }>;

export function FeatureLock({ feature }: { feature: LockedFeature }) {
  const content = copy[feature];

  return (
    <section className="relative min-h-[31rem] overflow-hidden rounded-xl border bg-card">
      <div className="pointer-events-none absolute inset-0 select-none overflow-hidden p-5 opacity-55 blur-[5px]" aria-hidden>
        {feature === "vault" ? <VaultPreview /> : <GaragePreview />}
      </div>
      <div className="absolute inset-0 bg-background/65" />
      <div className="relative z-10 flex min-h-[31rem] flex-col items-center justify-center px-6 py-10 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full border border-primary/30 bg-card text-primary shadow-lg">
          <LockKeyhole className="h-7 w-7" />
        </span>
        <h1 className="mt-5 text-2xl font-bold">{content.title}</h1>
        <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{content.description}</p>
        <Button
          size="lg"
          className="mt-6 h-auto max-w-sm whitespace-normal py-3 text-center leading-5"
          onClick={() => toast.info("Subscriptions are not connected in this preview.")}
        >
          {feature === "vault" ? <Zap /> : <BadgeCheck />}
          {content.action}
        </Button>
      </div>
    </section>
  );
}

function VaultPreview() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xl font-bold"><Zap className="text-primary" /> Active Build</div>
      {["Stage 2 ECU Remap", "Performance Exhaust", "Uprated Intercooler"].map((item) => (
        <div key={item} className="vault-card p-4">
          <span className="text-xs font-semibold text-primary">ENGINE / ECU</span>
          <p className="mt-2 font-bold">{item}</p>
          <p className="mt-1 text-sm text-success">Verified installation record</p>
        </div>
      ))}
    </div>
  );
}

function GaragePreview() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-xl font-bold"><Wrench className="text-primary" /> Garage Portal</div>
      <div className="vault-card space-y-4 p-5">
        <div className="grid grid-cols-2 gap-3">
          <div className="h-12 rounded-md border bg-background/70" />
          <div className="h-12 rounded-md border bg-background/70" />
        </div>
        <div className="h-28 rounded-md border bg-background/70" />
        <div className="h-12 rounded-md bg-primary" />
      </div>
      <div className="vault-card flex items-center gap-3 p-4 text-success">
        <BadgeCheck className="h-8 w-8" />
        <span className="font-bold">Verified Workshop stamp</span>
      </div>
    </div>
  );
}
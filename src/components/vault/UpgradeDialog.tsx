import { LockKeyhole, Zap } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAccount } from "@/lib/account-store";
import { useState } from "react";
import { ModalHeader } from "./ModalHeader";
import { useV1 } from "@/lib/use-v1";

export function UpgradeDialog({
  open,
  onOpenChange,
  nested = false,
  tier = "Pro DIY",
  price = "£0.99/mo",
  perks = ["OEM part numbers (Bosch, Febi Bilstein…)", "Fluid specs", "Parts vs labour cost breakdown", "High-res receipt attachments"],
  description,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  nested?: boolean;
  tier?: string;
  price?: string;
  perks?: string[];
  description?: string;
}) {
  const account = useAccount();
  const v1=useV1();
  const [busy, setBusy] = useState(false);
  async function chooseTier() {
    const plan = tier.toLowerCase().includes("modder") ? "pro_monthly" : tier.toLowerCase().includes("garage") || tier.toLowerCase().includes("workshop") ? "workshop_monthly" : "diy_monthly";
    setBusy(true);
    try {
      const result=await v1.checkout(plan);
      if(result.url) {window.location.assign(result.url);return;}
      toast.success(result.message);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Development role could not be changed");
    } finally { setBusy(false); }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent nested={nested} showCloseButton={false} className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0">
        <ModalHeader>
          <DialogTitle className="flex items-center gap-2">
            <LockKeyhole className="h-5 w-5 text-primary" /> Upgrade to {tier}
          </DialogTitle>
        <DialogDescription>{description ?? `Ad-free, ${price}. Cancel anytime.`}</DialogDescription>
        {account?.preview && <p className="mx-4 mt-3 text-xs text-amber-100">Sample plan preview. No payment will be taken.</p>}
        </ModalHeader>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-4 pb-6">
        <ul className="space-y-2 text-sm">
          {perks.map((p) => (
            <li key={p} className="flex gap-2">
              <Zap className="h-4 w-4 shrink-0 text-primary" /> {p}
            </li>
          ))}
        </ul>
        </div>
        <footer className="sticky bottom-0 z-20 flex-none border-t border-slate-800 bg-slate-900 p-4">
        <button
          className="btn-primary w-full"
          onClick={() => void chooseTier()}
          disabled={busy}
        >
          {busy?"Opening checkout…":account?.preview?`Preview ${tier}`:`Continue to Stripe · ${price}`}
        </button>
        </footer>
      </DialogContent>
    </Dialog>
  );
}

export function LockedField({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-2 rounded-lg border border-dashed border-input px-3 py-3 text-left text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary"
    >
      <span>{label}</span>
      <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-primary">
        <LockKeyhole className="h-3.5 w-3.5" /> Pro DIY
      </span>
    </button>
  );
}

import { LockKeyhole, Zap } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function UpgradeDialog({
  open,
  onOpenChange,
  tier = "Pro DIY",
  price = "£0.99/mo",
  perks = ["OEM part numbers (Bosch, Febi Bilstein…)", "Fluid specs", "Parts vs labour cost breakdown", "High-res receipt attachments"],
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  tier?: string;
  price?: string;
  perks?: string[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LockKeyhole className="h-5 w-5 text-primary" /> Upgrade to {tier}
          </DialogTitle>
          <DialogDescription>Ad-free, {price}. Cancel anytime.</DialogDescription>
        </DialogHeader>
        <ul className="space-y-2 text-sm">
          {perks.map((p) => (
            <li key={p} className="flex gap-2">
              <Zap className="h-4 w-4 shrink-0 text-primary" /> {p}
            </li>
          ))}
        </ul>
        <button
          className="btn-primary w-full"
          onClick={() => {
            toast.info("Subscriptions are not connected in this preview. Use Switch Role to try this tier.");
            onOpenChange(false);
          }}
        >
          Upgrade to {tier} ({price})
        </button>
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

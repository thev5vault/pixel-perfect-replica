import { Zap } from "lucide-react";
import { useAccount } from "@/lib/account-store";

export function DevPreviewButton() {
  const account = useAccount();
  if (!import.meta.env.DEV || !account?.startPreview) return null;
  return <div className="mt-4">
    <button type="button" onClick={account.startPreview} className="btn-ghost min-h-11 w-full border border-cyan-500/30 text-cyan-300">
      <Zap className="h-4 w-4 shrink-0" /> Direct GodMode Bypass (Kieran Admin)
    </button>
    <p className="mt-2 text-center text-[11px] text-slate-400">Development sample preview only. No real sign-in, accounts or database access.</p>
  </div>;
}

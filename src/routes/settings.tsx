import { createFileRoute } from "@tanstack/react-router";
import { AccountSettings } from "@/components/vault/AccountSettings";
import { ReminderSettingsPanel } from "@/components/vault/ReminderSettingsPanel";
import { TierPlans } from "@/components/vault/TierPlans";
import { useClerk } from "@clerk/react";
import { useAccount } from "@/lib/account-store";
export const Route = createFileRoute("/settings")({ component: SettingsPage });
function SettingsPage() {
  const clerk=useClerk();
  const account=useAccount();
  return <div className="space-y-5"><AccountSettings/><ReminderSettingsPanel/><button disabled={!account?.signedIn} className="btn-ghost w-full" onClick={()=>clerk.openUserProfile()}>Account security · verify email or phone</button><TierPlans/><div className="h-24 w-full shrink-0" aria-hidden="true"/></div>;
}

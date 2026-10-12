import { createFileRoute } from "@tanstack/react-router";
import { AccountSettings } from "@/components/vault/AccountSettings";
import { TierPlans } from "@/components/vault/TierPlans";
function GarageProfilePage() {
  return <div className="space-y-5"><AccountSettings /><TierPlans /></div>;
}
export const Route = createFileRoute("/account")({ component: GarageProfilePage });

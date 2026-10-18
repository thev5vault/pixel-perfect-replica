import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useAccount } from "@/lib/account-store";
import { SessionRestoreScreen } from "@/components/vault/SessionRestoreScreen";

export const Route = createFileRoute("/dashboard")({
  component: DashboardHandoff,
});

function DashboardHandoff() {
  const account = useAccount();
  const navigate = useNavigate();

  useEffect(() => {
    if (account?.authLoaded && !account.signedIn) {
      void navigate({ to: "/sign-in/$", params: { _splat: "" }, replace: true });
    }
  }, [account?.authLoaded, account?.signedIn, navigate]);

  return <SessionRestoreScreen />;
}

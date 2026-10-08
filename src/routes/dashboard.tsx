import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useAccount } from "@/lib/account-store";

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

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-slate-950 px-5 text-center text-slate-300">
      <p role="status">
        {account?.authLoaded ? "Opening your dashboard…" : "Restoring your session…"}
      </p>
    </main>
  );
}

import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BadgeCheck, Clock3, Wrench } from "lucide-react";
import { TierPlans } from "@/components/vault/TierPlans";
import { useAccount } from "@/lib/account-store";

export const Route = createFileRoute("/workshop/setup")({ component: WorkshopSetup });

function WorkshopSetup() {
  const account = useAccount();
  const user = account?.state?.user;
  const workshopActive = Boolean(
    user?.role === "dev_admin" ||
    (user?.role === "verified_garage" && user.status === "approved" && user.garage_verified && user.vat_verified && (user.workshop_access_active || user.subscription_tier === "verified_garage")),
  );

  return <main className="min-h-[100dvh] bg-slate-950 px-4 py-8 text-slate-100 sm:px-6">
    <div className="mx-auto max-w-3xl space-y-6">
      <Link to="/" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-300 hover:text-white"><Wrench className="h-4 w-4 text-amber-400" /> V5Vault Workshop</Link>
      {account?.loading || !account?.authLoaded ? <section role="status" className="vault-card animate-pulse p-6 text-sm text-slate-300">Preparing your workshop setup…</section> :
        !account.signedIn ? <section className="vault-card space-y-4 p-6">
          <h1 className="text-2xl font-bold">Sign in to set up your workshop</h1>
          <p className="text-sm leading-6 text-slate-300">Create or sign in to a V5Vault account to continue with the Verified Workshop trial.</p>
          <a href="/sign-up?intent=workshop" className="btn-primary min-h-12 w-full">Create workshop account</a>
        </section> :
        <>
          <section className="vault-card space-y-4 border-amber-400/20 p-6">
            <div className="flex items-start gap-3">
              <span className="rounded-xl bg-amber-400/10 p-2"><Wrench className="h-5 w-5 text-amber-300" /></span>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Verified Workshop onboarding</p>
                <h1 className="mt-1 text-2xl font-bold">Set up your workshop terminal</h1>
              </div>
            </div>
            <p className="text-sm leading-6 text-slate-300">Start a 30-day Verified Workshop trial, then complete your business profile and verification. Live service stamping remains restricted until the workshop application and VAT details are approved.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex gap-2 rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-sm"><Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" /><span>30-day trial · £9.99/month after trial</span></div>
              <div className="flex gap-2 rounded-xl border border-slate-800 bg-slate-950/50 p-3 text-sm"><BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" /><span>Approval and VAT verification are required for live stamps.</span></div>
            </div>
            {workshopActive && <Link to="/garage" className="btn-primary min-h-12 w-full">Open Workshop Terminal <ArrowRight className="h-4 w-4" /></Link>}
            {user?.role === "dev_admin" && <Link to="/account" className="btn-ghost min-h-11 w-full">Open Garage Profile</Link>}
          </section>
          {!workshopActive && <TierPlans workshopOnly />}
          {workshopActive && <div className="vault-card p-4 text-sm text-emerald-200">Your workshop access is active. Continue to the Workshop Terminal to stamp and manage jobs.</div>}
        </>
      }
    </div>
  </main>;
}

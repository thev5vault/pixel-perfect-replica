import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useAccount } from "@/lib/account-store";
import { accountRolePresentation } from "@/lib/account-role";
import type { AccountProfileInput } from "@/lib/account-profile";
import { toast } from "sonner";
import { Field, PageHeader, Pill } from "./ui-bits";
import { Loader2, Save } from "lucide-react";
import { PasskeySettings } from "./PasskeySettings";

export function AccountSettings() {
  const account = useAccount();
  const user = account?.state?.user;
  const roleView = user ? accountRolePresentation(user) : null;
  const canEditWorkshopDetails = Boolean(roleView?.isWorkshop && !roleView.isAdmin);
  const [name, setName] = useState(user?.full_name ?? "");
  const [garageName, setGarageName] = useState(user?.garage_name ?? "");
  const [registration, setRegistration] = useState(user?.garage_registration ?? "");
  const [workshopType, setWorkshopType] = useState<"garage"|"specialist">(user?.workshop_type??"garage");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setName(user?.full_name ?? ""); setGarageName(user?.garage_name ?? ""); setRegistration(user?.garage_registration ?? "");setWorkshopType(user?.workshop_type??"garage"); }, [user?.id, user?.full_name, user?.garage_name, user?.garage_registration,user?.workshop_type,user?.subscription_tier,user?.role]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!account) return;
    setBusy(true);
    const profile: AccountProfileInput = {
      full_name: name.trim(),
      ...(canEditWorkshopDetails
        ? { garage_name: garageName.trim(), garage_registration: registration.trim(), workshop_type: workshopType }
        : {}),
    };
    try { await account.saveProfile(profile); toast.success("Profile saved"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Profile could not be saved"); }
    finally { setBusy(false); }
  }
  if (!account?.state) return <div className="vault-card p-5"><p className="text-sm text-muted-foreground">Account details are not available.</p></div>;
  const currentRole = roleView ?? accountRolePresentation(account.state.user);
  return <div className="space-y-5">
    <PageHeader title="Account & settings" subtitle="Your profile and plan stay attached to your account." />
    <section className="vault-card border-cyan-500/20 p-5" aria-label="Active account role">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Account status</p>
          <h2 className="mt-1 break-words text-base font-bold">
            {currentRole.isAdmin ? "Role" : "Active Role"}: {currentRole.roleName} ({currentRole.planName})
          </h2>
          <p className="mt-2 text-xs text-muted-foreground">
            {account.preview
              ? "Development sample preview only. No payment is taken."
              : currentRole.isAdmin
                ? "Administrator access is granted by system permissions, not a subscription purchase."
                : "Subscription features are checked against your account and billing status."}
          </p>
        </div>
        <Pill tone={currentRole.isWorkshop ? "success" : "primary"}>{currentRole.badgeName}</Pill>
      </div>
    </section>
    <form onSubmit={save} className="vault-card space-y-4 p-5">
      <Field label="Display Name"><input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className="field" autoComplete="name" /></Field>
      {canEditWorkshopDetails && <section className="space-y-3 border-t border-slate-700 pt-4" aria-label="Workshop and trade details">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">WORKSHOP &amp; TRADE DETAILS</p>
        <Field label="Trading/Business Name"><input maxLength={100} value={garageName} onChange={(e) => setGarageName(e.target.value)} className="field" placeholder="Your trading or business name" /></Field>
        <Field label="Company Reg / VAT Number"><input maxLength={40} value={registration} onChange={(e) => setRegistration(e.target.value)} className="field" placeholder="Company registration or VAT number" /></Field>
        <Field label="Workshop type"><select value={workshopType} onChange={e=>setWorkshopType(e.target.value==="specialist"?"specialist":"garage")} className="field"><option value="garage">Garage</option><option value="specialist">Specialist workshop</option></select></Field>
        <p className="text-xs text-muted-foreground">Workshop stamping still requires an approved account and live VAT verification.</p>
        {garageName&&registration&&<p className="text-xs text-muted-foreground">Workshop application: {user?.status}. Changed trade details require administrator review before live stamping.</p>}
        {garageName&&registration&&user?.subscription_status==="trialing"&&user?.trial_expires_at&&<p className="text-xs text-cyan-300">Your no-card Workshop trial ends {new Date(user.trial_expires_at).toLocaleDateString("en-GB")}.</p>}
      </section>}
      <button disabled={busy} className="btn-primary w-full">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save profile</button>
    </form>
    {!currentRole.isAdmin && !currentRole.isWorkshop && <Link
      to="/settings"
      hash="plans-access"
      className="flex min-h-12 items-center justify-center rounded-xl border border-cyan-500/20 bg-cyan-950/20 px-4 py-3 text-center text-sm text-cyan-200 transition-colors hover:bg-cyan-950/40"
    >
      Want to stamp digital service logs? Upgrade to Verified Workshop (£9.99/mo)
    </Link>}
     <PasskeySettings/>
    {account.error && <p role="alert" className="text-sm text-red-300">{account.error}</p>}
  </div>;
}

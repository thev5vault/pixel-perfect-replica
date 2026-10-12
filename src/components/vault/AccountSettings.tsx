import { useEffect, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useAccount } from "@/lib/account-store";
import { accountRolePresentation } from "@/lib/account-role";
import { canEditWorkshopProfile, type AccountProfileInput } from "@/lib/account-profile";
import { toast } from "sonner";
import { Field, PageHeader, Pill } from "./ui-bits";
import { AlertTriangle, Loader2, Save, ShieldCheck, Wrench, Zap } from "lucide-react";
import { PasskeySettings } from "./PasskeySettings";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

const DELETE_CONFIRMATION = "DELETE MY ACCOUNT";

export function AccountSettings() {
  const account = useAccount();
  const navigate = useNavigate();
  const user = account?.state?.user;
  const roleView = user ? accountRolePresentation(user) : null;
  const canEditWorkshopDetails = Boolean(user && !roleView?.isAdmin && canEditWorkshopProfile(user));
  const [name, setName] = useState(user?.full_name ?? "");
  const [garageName, setGarageName] = useState(user?.garage_name ?? "");
  const [registration, setRegistration] = useState(user?.garage_registration ?? "");
  const [workshopType, setWorkshopType] = useState<"garage"|"specialist">(user?.workshop_type??"garage");
  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [deleting, setDeleting] = useState(false);
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
  async function deleteAccountPermanently() {
    if (deleteText !== DELETE_CONFIRMATION) return;
    setDeleting(true);
    try {
      const response = await fetch("/api/user/account", {
        method: "DELETE",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation: deleteText }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Account deletion could not be completed.");
      const message = "Account deleted. Vehicle service history has been anonymized and locked to the VIN for future owners.";
      sessionStorage.setItem("v5vault.account-deleted-toast", message);
      toast.success(message);
      setDeleteOpen(false);
      try { await account?.signOut(); } catch { /* Clerk deletion already revoked its sessions. */ }
      await navigate({ to: "/" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Account deletion could not be completed.");
    } finally {
      setDeleting(false);
    }
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
    <section className="vault-card space-y-3 p-4" aria-label="Display and accessibility">
      <div>
        <h2 className="text-lg font-bold text-white">Display &amp; Accessibility</h2>
        <p className="mt-1 text-sm text-slate-300">Choose a simpler, larger-text overview or the full technical detail view.</p>
      </div>
      <div role="group" aria-label="Preferred display mode" className="grid grid-cols-2 gap-2">
        {(["easy", "detailed"] as const).map((mode) => <button key={mode} type="button" aria-pressed={account.displayPreference === mode} onClick={() => void account.setDisplayPreference(mode).then(() => toast.success("Display preference saved")).catch((error) => toast.error(error instanceof Error ? error.message : "Display preference could not be saved"))} className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${account.displayPreference === mode ? "border-cyan-400/60 bg-cyan-500/15 text-white" : "border-slate-700 bg-slate-900 text-slate-300"}`}>
          {mode === "easy" ? <><Zap className="h-4 w-4 text-amber-400" /> Easy View</> : <><Wrench className="h-4 w-4 text-cyan-400" /> Detailed View</>}
        </button>)}
      </div>
      <p className="text-xs text-slate-400">{account.displayPreference === "easy" ? "Easy View uses clearer summaries and larger touch controls; advanced tools remain available." : "Detailed View keeps specifications and technical history expanded."}</p>
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
    <section className="vault-card space-y-3 p-5" aria-label="Privacy and data management">
      <div className="flex items-start gap-3">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-cyan-300" />
        <div className="min-w-0">
          <h2 className="font-semibold">Privacy &amp; Data Management</h2>
          <p className="mt-1 text-sm text-muted-foreground">Download a copy of your account and vehicle history, or permanently remove your account.</p>
        </div>
      </div>
      <a href="/api/user/export" className="btn-secondary flex min-h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-semibold">
        Download My Data
      </a>
      <button type="button" onClick={() => { setDeleteText(""); setDeleteOpen(true); }} className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-950/30 px-4 text-sm font-semibold text-red-200 hover:bg-red-950/60">
        <AlertTriangle className="h-4 w-4" /> Delete Account &amp; Data
      </button>
    </section>
    <Dialog open={deleteOpen} onOpenChange={(open) => { if (!deleting) setDeleteOpen(open); }}>
      <DialogContent className="space-y-4 rounded-2xl border border-red-500/30 bg-slate-950 p-5">
        <DialogTitle className="text-lg font-bold text-red-100">Permanently delete your account?</DialogTitle>
        <DialogDescription className="text-sm leading-relaxed text-slate-300">
          Your sign-in details, profile and billing link will be removed. Vehicle, service, modification and receipt history will remain attached to its VIN with keeper identity anonymized. This cannot be undone.
        </DialogDescription>
        <Field label={`Type ${DELETE_CONFIRMATION} to continue`}>
          <input value={deleteText} onChange={(event) => setDeleteText(event.target.value)} autoComplete="off" className="field text-base" disabled={deleting} />
        </Field>
        <button type="button" disabled={deleting || deleteText !== DELETE_CONFIRMATION} onClick={() => void deleteAccountPermanently()} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Confirm Permanent Deletion
        </button>
      </DialogContent>
    </Dialog>
    {account.error && <p role="alert" className="text-sm text-red-300">{account.error}</p>}
  </div>;
}

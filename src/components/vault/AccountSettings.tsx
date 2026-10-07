import { useEffect, useState } from "react";
import { useAccount } from "@/lib/account-store";
import { toast } from "sonner";
import { Field, PageHeader, Pill } from "./ui-bits";
import { Loader2, Save } from "lucide-react";

export function AccountSettings() {
  const account = useAccount();
  const user = account?.state?.user;
  const [name, setName] = useState(user?.full_name ?? "");
  const [garageName, setGarageName] = useState(user?.garage_name ?? "");
  const [registration, setRegistration] = useState(user?.garage_registration ?? "");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setName(user?.full_name ?? ""); setGarageName(user?.garage_name ?? ""); setRegistration(user?.garage_registration ?? ""); }, [user?.id, user?.full_name, user?.garage_name, user?.garage_registration]);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!account) return;
    setBusy(true);
    try { await account.saveProfile({ full_name: name.trim(), garage_name: garageName.trim(), garage_registration: registration.trim() }); toast.success("Profile saved"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Profile could not be saved"); }
    finally { setBusy(false); }
  }
  if (!account?.state) return <div className="vault-card p-5"><p className="text-sm text-muted-foreground">Account details are not available.</p></div>;
  return <div className="space-y-5">
    <PageHeader title="Account & settings" subtitle="Your profile and plan stay attached to your account." />
    <form onSubmit={save} className="vault-card space-y-4 p-5">
      <Field label="Full name"><input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className="field" /></Field>
      <div className="border-t border-slate-700 pt-4"><p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Workshop details</p><div className="space-y-3"><Field label="Workshop name"><input maxLength={100} value={garageName} onChange={(e) => setGarageName(e.target.value)} className="field" placeholder="Your workshop name" /></Field><Field label="Registration number"><input maxLength={40} value={registration} onChange={(e) => setRegistration(e.target.value)} className="field" placeholder="VAT / company registration" /></Field></div><p className="mt-2 text-xs text-muted-foreground">Saving a number does not verify a workshop or confer stamp permission.</p></div>
      <button disabled={busy} className="btn-primary w-full">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save profile</button>
    </form>
    <section className="vault-card p-5"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current plan</p><h2 className="mt-1 text-lg font-bold">{account.state.user.subscription_tier.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</h2><p className="mt-1 text-xs text-muted-foreground">Plan information is stored on your account profile.</p></div><Pill tone="primary">{account.state.user.subscription_tier === "free" ? "Free" : "Active"}</Pill></div><p className="mt-4 text-xs text-muted-foreground">Billing management is not connected in this build. A displayed plan does not represent a checkout action.</p></section>
    {account.error && <p role="alert" className="text-sm text-red-300">{account.error}</p>}
  </div>;
}

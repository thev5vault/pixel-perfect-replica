import { useEffect, useState, type FormEvent } from "react";
import { Building2, Check, Loader2, Save, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAccount } from "@/lib/account-store";
import { canUseWorkshopFeatures } from "@/lib/plans";
import type { AccountProfileInput } from "@/lib/account-profile";
import { Field, PageHeader, Pill } from "./ui-bits";
import { TierPlans } from "./TierPlans";

const ACCREDITATIONS = [
  ["imi", "IMI"],
  ["good_garage_scheme", "Good Garage Scheme"],
  ["bosch_service", "Bosch Service"],
] as const;

export function WorkshopBusinessProfile() {
  const account = useAccount();
  const user = account?.state?.user;
  const [name, setName] = useState("");
  const [vat, setVat] = useState("");
  const [logo, setLogo] = useState("");
  const [imi, setImi] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [accreditations, setAccreditations] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setName(user?.garage_name ?? "");
    setVat(user?.garage_registration ?? "");
    setLogo(user?.garage_logo_url ?? "");
    setImi(user?.imi_accreditation ?? "");
    setAddress(user?.garage_address ?? "");
    setPhone(user?.garage_phone ?? "");
    setEmail(user?.support_email ?? "");
    setAccreditations(user?.garage_accreditations ?? []);
  }, [user?.id, user?.garage_name, user?.garage_registration, user?.garage_logo_url, user?.imi_accreditation, user?.garage_address, user?.garage_phone, user?.support_email, user?.garage_accreditations]);

  const allowed = Boolean(user && (user.role === "dev_admin" || canUseWorkshopFeatures(user)));
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!account || !user) return;
    setBusy(true);
    const profile: AccountProfileInput = {
      full_name: user.full_name || user.garage_name || "Workshop",
      garage_name: name.trim(),
      garage_registration: vat.trim(),
      workshop_type: user.workshop_type ?? "garage",
      garage_logo_url: logo,
      imi_accreditation: imi.trim(),
      garage_address: address.trim(),
      garage_phone: phone.trim(),
      support_email: email.trim(),
      garage_accreditations: accreditations,
    };
    try {
      await account.saveProfile(profile);
      toast.success("Workshop profile saved");
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Workshop profile could not be saved");
    } finally {
      setBusy(false);
    }
  }

  function uploadLogo(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/") || file.size > 900_000) {
      toast.error("Choose an image file under 900 KB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setLogo(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => toast.error("Logo image could not be read.");
    reader.readAsDataURL(file);
  }

  return <div className="space-y-5">
    <PageHeader icon={<Building2 className="h-5 w-5 text-primary" />} title="Garage Profile" subtitle="Workshop branding, accreditation, contact details and billing." />
    {!allowed ? <section className="vault-card p-5"><h2 className="font-bold">Verified Workshop access required</h2><p className="mt-2 text-sm text-muted-foreground">This profile is available to approved workshop accounts.</p></section> : <>
      <form onSubmit={(event) => void save(event)} className="vault-card space-y-5 p-4">
        <section className="space-y-3">
          <h2 className="font-bold">Garage branding</h2>
          <Field label="Trading name"><input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} className="field" /></Field>
          <Field label="Workshop logo upload">
            <input type="file" accept="image/*" onChange={(event) => uploadLogo(event.target.files?.[0])} className="block min-h-11 w-full text-sm text-muted-foreground file:mr-3 file:min-h-11 file:rounded-lg file:border-0 file:bg-slate-800 file:px-3 file:text-slate-100" />
          </Field>
          {logo && <img src={logo} alt={`${name || "Workshop"} logo preview`} className="h-20 max-w-full rounded-lg border border-slate-700 bg-slate-950 p-2 object-contain" />}
          <div className="flex items-center gap-3 rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-3">
            <ShieldCheck className="h-7 w-7 text-cyan-300" /><div><p className="text-sm font-semibold">V5Vault Digital Stamp Seal</p><Pill tone={user?.garage_verified && user?.vat_verified ? "success" : "warning"}>{user?.garage_verified && user?.vat_verified ? "Verified workshop" : "Verification pending"}</Pill></div>
          </div>
        </section>
        <section className="space-y-3 border-t border-slate-800 pt-4">
          <h2 className="font-bold">Verification &amp; accreditation</h2>
          <Field label="VAT / company registration number"><input maxLength={40} value={vat} onChange={(event) => setVat(event.target.value)} className="field" /></Field>
          <Field label="IMI accreditation number"><input maxLength={100} value={imi} onChange={(event) => setImi(event.target.value)} className="field" /></Field>
          <div className="space-y-2">{ACCREDITATIONS.map(([id, label]) => <label key={id} className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-800 px-3 text-sm"><input type="checkbox" checked={accreditations.includes(id)} onChange={(event) => setAccreditations((current) => event.target.checked ? [...new Set([...current, id])] : current.filter((item) => item !== id))} className="h-4 w-4 accent-cyan-400" />{label}{accreditations.includes(id) && <Check className="ml-auto h-4 w-4 text-emerald-400" />}</label>)}</div>
        </section>
        <section className="space-y-3 border-t border-slate-800 pt-4">
          <h2 className="font-bold">Workshop contact info</h2>
          <Field label="Shop address"><textarea rows={3} maxLength={500} value={address} onChange={(event) => setAddress(event.target.value)} className="field" /></Field>
          <Field label="Phone number"><input type="tel" maxLength={40} value={phone} onChange={(event) => setPhone(event.target.value)} className="field" /></Field>
          <Field label="Customer support email"><input type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className="field" /></Field>
        </section>
        <button disabled={busy} className="btn-primary min-h-12 w-full">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save workshop profile</button>
      </form>
      <TierPlans workshopOnly compact />
    </>}
  </div>;
}

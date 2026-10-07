import { useEffect, useState, type FormEvent } from "react";
import { Bell, LoaderCircle, RefreshCw, Save } from "lucide-react";
import { useV1 } from "@/lib/use-v1";
import type { ReminderPreferences } from "@/lib/v1-types";

export function ReminderSettingsPanel() {
  const v1 = useV1();
  const [prefs, setPrefs] = useState<ReminderPreferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => { let alive = true; void v1.getPreferences().then((p) => alive && setPrefs(p)).catch((e: unknown) => alive && setError(message(e, "Reminder preferences could not be loaded."))); return () => { alive = false; }; }, [v1]);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!prefs || busy) return;
    if (prefs.sms && !/^\+[1-9]\d{7,14}$/.test(prefs.phone)) { setError("Enter an E.164 number, such as +447700900123."); return; }
    setBusy(true); setError(""); setNotice("");
    try { await v1.savePreferences(prefs); setNotice("Your reminder preferences were saved."); }
    catch (e) { setError(message(e, "Preferences could not be saved.")); }
    finally { setBusy(false); }
  }
  return <section className="vault-card overflow-hidden">
    <header className="border-b border-border p-5"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Preferences / consent</p><h2 className="mt-1 flex items-center gap-2 text-xl font-bold"><Bell className="h-5 w-5 text-primary"/>Reminder channels</h2><p className="mt-1 text-sm text-muted-foreground">Nothing is opted in by default. Change or withdraw preferences at any time.</p></header>
    {error && <div role="alert" className="mx-4 mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm"><p>{error}</p>{!prefs && <button type="button" className="mt-2 inline-flex min-h-10 items-center gap-2 underline" onClick={() => void v1.getPreferences().then(setPrefs).catch((e: unknown) => setError(message(e, "Reminder preferences could not be loaded.")))}><RefreshCw className="h-4 w-4"/>Retry</button>}</div>}
    {notice && <p role="status" className="mx-4 mt-4 rounded-lg border border-success/30 bg-success/10 p-3 text-sm">{notice}</p>}
    {!prefs ? <div className="space-y-3 p-5" role="status"><div className="h-8 w-48 animate-pulse rounded bg-muted"/><div className="h-16 animate-pulse rounded bg-muted/60"/></div> :
      <form onSubmit={(e) => void submit(e)} className="space-y-4 p-5 pb-8">
        <label className="flex min-h-14 items-center gap-3 rounded-xl border border-border px-4"><input type="checkbox" className="h-5 w-5 accent-primary" checked={prefs.email} onChange={(e) => setPrefs({ ...prefs, email: e.target.checked })}/><span className="flex-1"><span className="block font-semibold">Email reminders</span><span className="text-xs text-muted-foreground">Only where a customer email is configured and consented.</span></span></label>
        <label className="flex min-h-14 items-center gap-3 rounded-xl border border-border px-4"><input type="checkbox" className="h-5 w-5 accent-primary" checked={prefs.sms} onChange={(e) => setPrefs({ ...prefs, sms: e.target.checked })}/><span className="flex-1"><span className="block font-semibold">SMS reminders</span><span className="text-xs text-muted-foreground">Requires an international-format telephone number.</span></span></label>
        <label className="block space-y-1.5"><span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Workshop sender phone · E.164</span><input className="field min-h-12 text-base" inputMode="tel" autoComplete="tel" placeholder="+447700900123" value={prefs.phone} onChange={(e) => setPrefs({ ...prefs, phone: e.target.value })} aria-describedby="phone-help"/><span id="phone-help" className="block text-xs text-muted-foreground">Required only when SMS is enabled. Use + followed by country code and number.</span></label>
        <button className="btn-primary min-h-12 w-full" type="submit" disabled={busy}>{busy ? <LoaderCircle className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>}{busy ? "Saving preferences…" : "Save preferences"}</button>
      </form>}
  </section>;
}
function message(error: unknown, fallback: string) { return error instanceof Error ? error.message : fallback; }

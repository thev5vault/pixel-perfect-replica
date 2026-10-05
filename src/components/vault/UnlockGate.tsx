import { useEffect, useState } from "react";
import { Fingerprint, KeyRound, LockKeyhole, Loader2, ScanFace, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { formatVrm, useVault } from "@/lib/vault-store";
import { ShieldLogo } from "./ui-bits";

const formatRef = (v: string) => {
  const d = v.replace(/\D/g, "").slice(0, 11);
  return [d.slice(0, 4), d.slice(4, 8), d.slice(8)].filter(Boolean).join(" ");
};

export function UnlockGate() {
  const { unlocked, pin } = useVault();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background p-5" style={{ backgroundImage: "var(--gradient-vault)" }}>
      {unlocked && !pin ? <SecuritySetup /> : <VerifyForm />}
    </div>
  );
}

function VerifyForm() {
  const { unlock, notice, clearNotice, v5cRefs, activeVrm } = useVault();
  const [vrm, setVrm] = useState("");
  const [ref, setRef] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (notice) toast.error("Ownership Unlinked", { description: notice });
  }, [notice]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!vrm.trim()) return setError("Enter your registration mark.");
    if (ref.replace(/\D/g, "").length !== 11) return setError("Your V5C reference must be exactly 11 digits.");
    setBusy(true);
    await new Promise((r) => setTimeout(r, 1500));
    const ok = unlock(vrm, ref);
    setBusy(false);
    if (!ok) setError("Those details don't match the DVLA record. Check the reference on your current V5C.");
  }

  return (
    <form onSubmit={submit} className="w-full max-w-sm animate-vault-open space-y-6">
      <div className="text-center">
        <ShieldLogo className="mx-auto h-16 w-16 animate-shield" />
        <h1 className="mt-4 text-3xl font-bold">V5Vault</h1>
        <p className="text-sm text-muted-foreground">UK Digital Vehicle Passport</p>
      </div>

      {notice && (
        <div className="flex gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm">
          <ShieldAlert className="h-5 w-5 shrink-0 text-destructive" />
          <div className="flex-1">
            <p className="font-semibold">Ownership Unlinked</p>
            <p className="text-muted-foreground">{notice}</p>
          </div>
          <button type="button" onClick={clearNotice} className="text-xs text-muted-foreground">Dismiss</button>
        </div>
      )}

      <div className="vault-card space-y-5 p-5">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <LockKeyhole className="h-4 w-4 text-primary" /> V5C Logbook Verification
        </div>

        <div className="space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Registration Mark</span>
          <div className="uk-plate w-full text-2xl">
            <span className="flex items-center bg-primary/80 px-2 font-sans text-xs font-bold text-primary-foreground">UK</span>
            <input
              value={vrm}
              onChange={(e) => setVrm(formatVrm(e.target.value).slice(0, 8))}
              placeholder="AB14 CDE"
              aria-label="Registration mark"
              autoCapitalize="characters"
              className="w-full bg-transparent px-3 py-2 text-center uppercase outline-none placeholder:text-plate-foreground/30"
            />
          </div>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">11-Digit V5C Reference Number</span>
          <input
            value={ref}
            onChange={(e) => setRef(formatRef(e.target.value))}
            inputMode="numeric"
            autoComplete="off"
            placeholder="1234 5678 901"
            className="field font-display text-lg tracking-[0.2em]"
          />
        </label>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
          {busy ? "Verifying against live DVLA registry..." : "Unlock Vault"}
        </button>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Demo: <span className="font-semibold text-foreground">{formatVrm(activeVrm)}</span> · V5C ref{" "}
        <span className="font-semibold text-foreground">{formatRef(v5cRefs[activeVrm] ?? "")}</span>
      </p>
    </form>
  );
}

function SecuritySetup() {
  const { setupSecurity } = useVault();
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [bio, setBio] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(pin)) return setError("Your Vault Master PIN must be 6 digits.");
    if (pin !== confirm) return setError("PINs don't match.");
    if (/^(\d)\1{5}$/.test(pin) || pin === "123456") return setError("Choose a less predictable PIN.");
    setBusy(true);
    if (bio) await new Promise((r) => setTimeout(r, 1200));
    setupSecurity(pin, bio);
    toast.success("Vault secured", { description: bio ? "Master PIN and biometric unlock enabled." : "Master PIN set." });
  }

  const pinInput = (value: string, set: (v: string) => void, label: string) => (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</span>
      <input
        type="password"
        inputMode="numeric"
        autoComplete="new-password"
        value={value}
        onChange={(e) => set(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="••••••"
        className="field text-center font-display text-2xl tracking-[0.6em]"
      />
    </label>
  );

  return (
    <form onSubmit={submit} className="w-full max-w-sm animate-vault-open space-y-6">
      <div className="text-center">
        <KeyRound className="mx-auto h-14 w-14 text-primary" />
        <h1 className="mt-4 text-2xl font-bold">Secure your Vault</h1>
        <p className="text-sm text-muted-foreground">Ownership verified. Set up your Master PIN before accessing your records.</p>
      </div>
      <div className="vault-card space-y-5 p-5">
        {pinInput(pin, setPin, "New 6-Digit Vault Master PIN")}
        {pinInput(confirm, setConfirm, "Confirm PIN")}
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-background/50 p-3">
          <div className="flex items-center gap-2">
            <ScanFace className="h-5 w-5 text-primary" />
            <Fingerprint className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold">FaceID / Fingerprint unlock</span>
          </div>
          <Switch checked={bio} onCheckedChange={setBio} aria-label="Enable biometric unlock" />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockKeyhole className="h-4 w-4" />}
          {busy ? "Registering biometrics…" : "Secure & Enter Vault"}
        </button>
      </div>
    </form>
  );
}

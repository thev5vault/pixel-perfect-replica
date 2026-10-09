import { useEffect, useState } from "react";
import { Fingerprint, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAccount } from "@/lib/account-store";
import { getRegisteredPasskeyCount, registerPasskey } from "@/services/passkeyClient";

export function PasskeySettings() {
  const account = useAccount();
  const [busy, setBusy] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!account?.signedIn || !account.state || account.preview) return;
    let active = true;
    void getRegisteredPasskeyCount()
      .then((passkeyCount) => { if (active) setCount(passkeyCount); })
      .catch(() => { if (active) setCount(null); });
    return () => { active = false; };
  }, [account?.signedIn, account?.state?.user.id, account?.preview]);

  async function addPasskey() {
    if (!window.isSecureContext || typeof window.PublicKeyCredential === "undefined" || typeof navigator.credentials?.create !== "function") {
      toast.error("Passkeys require a compatible browser and a secure connection.");
      return;
    }
    if (account?.state?.user.email_verified !== true) {
      toast.error("Verify your email before adding a passkey.");
      return;
    }
    setBusy(true);
    try {
      const nextCount = await registerPasskey();
      setCount(nextCount);
      toast.success("Passkey added. Use Face ID / Touch ID to sign in.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        toast.info("Passkey registration was cancelled. No passkey was added.");
        return;
      }
      toast.error(error instanceof Error ? error.message : "Passkey could not be added.");
    } finally {
      setBusy(false);
    }
  }

  if (!account?.signedIn || !account.state || account.preview) return null;
  return (
    <section className="vault-card space-y-3 p-5" aria-labelledby="passkey-settings-title">
      <div>
        <h2 id="passkey-settings-title" className="text-base font-semibold">Face ID / Passkey</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a device passkey for Face ID, Touch ID, or another compatible authenticator. V5Vault verifies passkeys on its own server.
        </p>
      </div>
      <p className="text-xs text-slate-400" aria-live="polite">
        {count === null ? "Passkey status is unavailable right now." : count === 0 ? "No passkeys registered." : `${count} passkey${count === 1 ? "" : "s"} registered.`}
      </p>
      <button type="button" disabled={busy} onClick={() => void addPasskey()} className="btn-ghost w-full">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
        {busy ? "Waiting for device…" : "Register Face ID / Add Passkey"}
      </button>
    </section>
  );
}

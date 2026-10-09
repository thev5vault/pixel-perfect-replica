import { useState } from "react";
import { useUser } from "@clerk/react";
import { Fingerprint, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAccount } from "@/lib/account-store";

export function PasskeySettings() {
  const account = useAccount();
  const { isLoaded, user } = useUser();
  const [busy, setBusy] = useState(false);

  if (!isLoaded || !user || account?.preview) return null;
  const clerkUser = user;

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
      await clerkUser.createPasskey();
      await clerkUser.reload();
      toast.success("Passkey added. Use Face ID / Touch ID to sign in on this device.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Passkey could not be added.");
    } finally {
      setBusy(false);
    }
  }

  const count = clerkUser.passkeys.length;
  return (
    <section className="vault-card space-y-3 p-5" aria-labelledby="passkey-settings-title">
      <div>
        <h2 id="passkey-settings-title" className="text-base font-semibold">Face ID / Passkey</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Register Face ID, Touch ID, or another device authenticator for secure sign-in. Passkeys are managed securely by Clerk.
        </p>
      </div>
      <p className="text-xs text-slate-400" aria-live="polite">
        {count === 0 ? "No passkeys registered." : `${count} passkey${count === 1 ? "" : "s"} registered.`}
      </p>
      <button type="button" disabled={busy} onClick={() => void addPasskey()} className="btn-ghost w-full">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
        {busy ? "Waiting for device…" : "Register Face ID / Add Passkey"}
      </button>
    </section>
  );
}

import { useState } from "react";
import { Fingerprint } from "lucide-react";
import { toast } from "sonner";
import { authenticateWithPasskey, PasskeyClientError } from "@/services/passkeyClient";

const NO_PASSKEY_MESSAGE = "No Face ID linked yet. Please sign in and register Face ID in Account Settings.";

export function PasskeySignInButton({ onAuthenticated }: { onAuthenticated?: () => void }) {
  const [busy, setBusy] = useState(false);

  async function signInWithPasskey() {
    if (!window.isSecureContext || typeof window.PublicKeyCredential === "undefined" || typeof navigator.credentials?.get !== "function") {
      toast.error("Passkeys require a compatible browser and a secure connection.");
      return;
    }
    setBusy(true);
    try {
      await authenticateWithPasskey();
      if (onAuthenticated) onAuthenticated();
      else window.location.assign("/dashboard");
    } catch (error) {
      if (error instanceof PasskeyClientError && error.code === "NO_PASSKEYS_REGISTERED") {
        toast.info(NO_PASSKEY_MESSAGE);
        return;
      }
      if (error instanceof DOMException && error.name === "NotAllowedError") {
        toast.info(NO_PASSKEY_MESSAGE);
        return;
      }
      toast.error(error instanceof Error ? error.message : "Passkey sign-in could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void signInWithPasskey()}
      disabled={busy}
      className="btn-ghost mt-3 w-full sm:mt-4"
      aria-label="Sign in with Face ID or Touch ID"
    >
      <Fingerprint className="h-4 w-4" />
      {busy ? "Waiting for passkey…" : "Sign in with Face ID / Touch ID"}
    </button>
  );
}

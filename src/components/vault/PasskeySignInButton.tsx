import { useState } from "react";
import { useSignIn } from "@clerk/react/legacy";
import { Fingerprint } from "lucide-react";
import { toast } from "sonner";

export function PasskeySignInButton() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const [busy, setBusy] = useState(false);

  async function signInWithPasskey() {
    if (!window.isSecureContext || typeof window.PublicKeyCredential === "undefined" || typeof navigator.credentials?.get !== "function") {
      toast.error("Passkeys require a compatible browser and a secure connection.");
      return;
    }
    if (!isLoaded || !signIn || !setActive) {
      toast.error("Authentication is still loading. Try again in a moment.");
      return;
    }
    setBusy(true);
    try {
      const attempt = await signIn.authenticateWithPasskey({ flow: "discoverable" });
      if (attempt.status !== "complete" || !attempt.createdSessionId) {
        toast.error("Another verification step is required. Continue with the sign-in form.");
        return;
      }
      await setActive({
        session: attempt.createdSessionId,
        navigate: async ({ decorateUrl }) => {
          window.location.assign(decorateUrl("/dashboard"));
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Passkey sign-in could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void signInWithPasskey()}
      disabled={busy || !isLoaded}
      className="btn-ghost mt-4 w-full"
      aria-label="Sign in with Face ID or Touch ID"
    >
      <Fingerprint className="h-4 w-4" />
      {busy ? "Waiting for passkey…" : "Sign in with Face ID / Touch ID"}
    </button>
  );
}

import { useState } from "react";
import { useClerk } from "@clerk/react";
import { Fingerprint } from "lucide-react";
import { toast } from "sonner";

const NO_PASSKEY_MESSAGE = "No Face ID linked yet. Please sign in and register Face ID in Account Settings.";

function isMissingPasskey(error: unknown): boolean {
  if (error instanceof DOMException && error.name === "NotAllowedError") return true;
  if (!error || typeof error !== "object") return false;

  const clerkErrors = (error as { errors?: unknown }).errors;
  if (!Array.isArray(clerkErrors)) return false;
  return clerkErrors.some((item) => {
    if (!item || typeof item !== "object") return false;
    const entry = item as { code?: unknown; message?: unknown; longMessage?: unknown };
    const code = String(entry.code ?? "");
    const message = `${String(entry.message ?? "")} ${String(entry.longMessage ?? "")}`;
    return (/passkey/i.test(code) && /(not_found|not_present|missing|no_credentials)/i.test(code))
      || /no (?:registered )?passkeys?|passkey (?:was )?not found|no face id linked/i.test(message);
  });
}

export function PasskeySignInButton() {
  const clerk = useClerk();
  const [busy, setBusy] = useState(false);

  async function signInWithPasskey() {
    if (!window.isSecureContext || typeof window.PublicKeyCredential === "undefined" || typeof navigator.credentials?.get !== "function") {
      toast.error("Passkeys require a compatible browser and a secure connection.");
      return;
    }
    if (!clerk.loaded || !clerk.client) {
      toast.error("Authentication is still loading. Try again in a moment.");
      return;
    }
    setBusy(true);
    try {
      const attempt = await clerk.client.signIn.authenticateWithPasskey({ flow: "discoverable" });
      if (attempt.status !== "complete" || !attempt.createdSessionId) {
        toast.error("Another verification step is required. Continue with the sign-in form.");
        return;
      }
      await clerk.setActive({
        session: attempt.createdSessionId,
        navigate: async ({ decorateUrl }) => {
          window.location.assign(decorateUrl("/dashboard"));
        },
      });
    } catch (error) {
      if (isMissingPasskey(error)) {
        toast.info(NO_PASSKEY_MESSAGE);
        return;
      }
      const message = error instanceof Error ? error.message : "Passkey sign-in could not be completed.";
      if (/passkey does not match one of the allowed values for parameter strategy/i.test(message)) {
        toast.error("Passkey sign-in is unavailable for this Clerk account. Sign in with email, then register Face ID in Account Settings.");
        return;
      }
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void signInWithPasskey()}
      disabled={busy || !clerk.loaded}
      className="btn-ghost mt-4 w-full"
      aria-label="Sign in with Face ID or Touch ID"
    >
      <Fingerprint className="h-4 w-4" />
      {busy ? "Waiting for passkey…" : "Sign in with Face ID / Touch ID"}
    </button>
  );
}

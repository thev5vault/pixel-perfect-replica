import { useEffect, useState, type ReactNode } from "react";
import { useClerk, useUser } from "@clerk/react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { previewEnabled } from "@/lib/sample-account";
import {
  clearPendingSignup, isRecoveryRoute, isExpiredRecoveryError, pendingEmailFromSignup,
  readPendingSignup, savePendingSignup, VERIFY_EMAIL_PATH,
} from "@/lib/signup-recovery";

function pendingHint() {
  try { return readPendingSignup(window.sessionStorage); } catch { return null; }
}
function saveHint(email: string) {
  try { savePendingSignup(window.sessionStorage, email); } catch { /* Storage access can be blocked by Safari. */ }
}

export function SignupRecovery({ children }: { children: ReactNode }) {
  const clerk = useClerk();
  const { isLoaded, isSignedIn } = useUser();
  const navigate = useNavigate();
  const [recovering, setRecovering] = useState(() => !previewEnabled() && Boolean(pendingHint()));

  useEffect(() => {
    if (!isLoaded) return;
    if (isSignedIn || previewEnabled()) {
      clearPendingSignup();
      setRecovering(false);
      return;
    }
    let disposed = false;
    let inFlight = false;
    let expiredAttempt: string | undefined;
    const goToVerification = () => {
      const path = window.location.pathname;
      if (isRecoveryRoute(path) && path !== VERIFY_EMAIL_PATH && !path.includes("sso-callback")) {
        void navigate({ to: "/sign-up/$", params: { _splat: "verify-email-address" }, replace: true });
      }
    };
    const restartExpired = () => {
      expiredAttempt = clerk.client?.signUp.id;
      clearPendingSignup();
      if (isRecoveryRoute(window.location.pathname)) {
        toast.info("Your email verification session has expired. Please start sign-up again.");
        void navigate({ to: "/sign-up/$", params: { _splat: "" }, replace: true });
      }
    };
    const observe = (signup: typeof clerk.client.signUp | undefined) => {
      if (disposed || previewEnabled()) return;
      if (expiredAttempt && signup?.id === expiredAttempt) return;
      const email = pendingEmailFromSignup(signup);
      if (email && (window.location.pathname.startsWith("/sign-up") || pendingHint())) {
        saveHint(email);
        goToVerification();
      } else if (signup?.status === "complete") clearPendingSignup();
    };
    const restore = async () => {
      if (disposed || inFlight || document.visibilityState === "hidden") return;
      if(previewEnabled()) {setRecovering(false);return;}
      if (!pendingHint() && !(window.location.pathname.startsWith("/sign-up") && clerk.client?.signUp.id !== expiredAttempt && pendingEmailFromSignup(clerk.client?.signUp))) {
        setRecovering(false);
        return;
      }
      inFlight = true;
      try {
        // Fetch the existing Clerk client attempt. Never recreate signup, resend
        // codes, store passwords, or trust sessionStorage to activate a session.
        const client = await clerk.client.reload();
        if (disposed || previewEnabled()) return;
        const email = pendingEmailFromSignup(client.signUp);
        if (email) {
          saveHint(email);
          goToVerification();
        } else {
          if (client.signUp?.status !== "complete") restartExpired();
          else clearPendingSignup();
        }
      } catch (error) {
        if (!disposed) {
          if (isExpiredRecoveryError(error)) restartExpired();
          else toast.error("Could not reconnect to email verification. Check your connection and return to this screen to retry.");
        }
        // Preserve the hint on network failure so a later focus can retry.
      } finally {
        inFlight = false;
        if (!disposed) setRecovering(false);
      }
    };
    const hadHint = Boolean(pendingHint());
    const unsubscribe = clerk.addListener(({ client }) => observe(client?.signUp));
    observe(clerk.client?.signUp);
    if (hadHint) void restore();
    else setRecovering(false);
    const onReturn = () => { if (document.visibilityState !== "hidden") void restore(); };
    window.addEventListener("pageshow", onReturn);
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      disposed = true;
      unsubscribe();
      window.removeEventListener("pageshow", onReturn);
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [isLoaded, isSignedIn, clerk, navigate]);

  if (recovering) return <div className="flex min-h-[100dvh] items-center justify-center bg-slate-950 text-slate-400" role="status">Restoring email verification…</div>;
  return <>{children}</>;
}

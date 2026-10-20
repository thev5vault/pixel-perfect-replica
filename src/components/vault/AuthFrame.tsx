import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { V5VaultLogo } from "./V5VaultLogo";
import { clearPendingSignup } from "@/lib/signup-recovery";
import { watchAuthInputs } from "@/lib/auth-inputs";
import { DevPreviewButton } from "./DevPreviewButton";
import { PasskeySignInButton } from "./PasskeySignInButton";

export function AuthFrame({ mode, children, signInUrl = "/sign-in", signUpUrl = "/sign-up" }: { mode: "sign-in" | "sign-up"; children: ReactNode; signInUrl?: string; signUpUrl?: string }) {
  const signup = mode === "sign-up";
  const root = useRef<HTMLElement>(null);
  useEffect(() => root.current ? watchAuthInputs(root.current) : undefined, []);
  return <main ref={root} className="vault-auth relative flex min-h-[100dvh] max-h-[100dvh] w-full items-start justify-center overflow-x-hidden overflow-y-auto overscroll-contain bg-slate-950 px-4 py-5 sm:items-center sm:py-10">
    <div className="pointer-events-none absolute -left-32 top-10 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
    <div className="relative my-auto w-full min-w-0 max-w-md">
      <Link to="/" onClick={clearPendingSignup} className="mb-3 flex items-center justify-center gap-2 text-lg font-bold sm:mb-6 sm:gap-3"><V5VaultLogo className="h-9 w-9 sm:h-10 sm:w-10" /> V5Vault</Link>
      {children}
      {import.meta.env.DEV && !signup && <div className="mt-3 border-t border-slate-800 pt-2 sm:mt-6 sm:pt-4"><DevPreviewButton /></div>}
      {!signup && <PasskeySignInButton />}
      <p className="mt-3 text-center text-sm text-slate-400 sm:mt-5">
        {signup ? "Already registered?" : "New to V5Vault?"}{" "}
          <a onClick={clearPendingSignup} className="font-semibold text-cyan-300 underline-offset-4 hover:underline" href={signup ? signInUrl : signUpUrl}>
          {signup ? "Sign in" : "Create account"}
        </a>
      </p>
    </div>
  </main>;
}

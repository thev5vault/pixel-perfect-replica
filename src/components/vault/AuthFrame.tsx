import { useEffect, useRef, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { V5VaultLogo } from "./V5VaultLogo";
import { clearPendingSignup } from "@/lib/signup-recovery";
import { watchAuthInputs } from "@/lib/auth-inputs";
import { Fingerprint } from "lucide-react";
import { toast } from "sonner";

export function AuthFrame({ mode, children }: { mode: "sign-in" | "sign-up"; children: ReactNode }) {
  const signup = mode === "sign-up";
  const root = useRef<HTMLElement>(null);
  useEffect(() => root.current ? watchAuthInputs(root.current) : undefined, []);
  return <main ref={root} className="vault-auth relative flex min-h-[100dvh] items-center justify-center overflow-x-hidden bg-slate-950 px-4 py-10">
    <div className="pointer-events-none absolute -left-32 top-10 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
    <div className="relative w-full max-w-md">
      <Link to="/" onClick={clearPendingSignup} className="mb-6 flex items-center justify-center gap-3 text-lg font-bold"><V5VaultLogo className="h-10 w-10" /> V5Vault</Link>
      {children}
      {!signup && import.meta.env.DEV && <button type="button" onClick={() => toast.info("Biometric demo only. Use your email and password to authenticate; this prompt does not sign you in.")} className="btn-ghost mt-4 w-full"><Fingerprint className="h-4 w-4" /> Sign in with Face ID / Touch ID <span className="rounded border border-amber-500/30 px-1.5 py-0.5 text-[9px] uppercase text-amber-200">Simulation</span></button>}
      <p className="mt-5 text-center text-sm text-slate-400">
        {signup ? "Already registered?" : "New to V5Vault?"}{" "}
        <a onClick={clearPendingSignup} className="font-semibold text-cyan-300 underline-offset-4 hover:underline" href={signup ? "/sign-in" : "/sign-up"}>
          {signup ? "Sign in" : "Create account"}
        </a>
      </p>
    </div>
  </main>;
}

import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Fingerprint, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { V5VaultLogo } from "./V5VaultLogo";

export function AuthFrame({ mode, children }: { mode: "sign-in" | "sign-up"; children: ReactNode }) {
  const signup = mode === "sign-up";
  return <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-slate-950 px-4 py-10">
    <div className="pointer-events-none absolute -left-32 top-10 h-80 w-80 rounded-full bg-cyan-500/10 blur-3xl" />
    <div className="relative w-full max-w-md">
      <Link to="/" className="mb-6 flex items-center justify-center gap-3 text-lg font-bold"><V5VaultLogo className="h-10 w-10" /> V5Vault</Link>
      <div className="vault-card p-5 sm:p-7">
        <div className="mb-5 text-center"><p className="font-mono text-[10px] uppercase tracking-[.2em] text-cyan-300">{signup ? "Start your passport" : "Welcome back"}</p><h1 className="mt-2 text-2xl font-bold">{signup ? "Create your account" : "Sign in to V5Vault"}</h1><p className="mt-2 text-sm text-muted-foreground">{signup ? "Your vehicle links and service records belong to you." : "Pick up where your vehicle history left off."}</p></div>
        {children}
        {import.meta.env.DEV && <button type="button" onClick={() => toast.info("Biometric demo only. Use your email and password to authenticate; this prompt does not sign you in.")} className="btn-ghost mt-4 w-full"><Fingerprint className="h-4 w-4" /> Sign in with Face ID / Touch ID <span className="rounded border border-amber-500/30 px-1.5 py-0.5 text-[9px] uppercase text-amber-200">Simulation</span></button>}
        <p className="mt-4 flex items-center justify-center gap-2 text-center text-[11px] text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> V5C claims require the reference on your logbook.</p>
      </div>
      <p className="mt-5 text-center text-sm text-slate-400">{signup ? "Already registered?" : "New to V5Vault?"} <a className="font-semibold text-cyan-300 underline-offset-4 hover:underline" href={signup ? "/sign-in" : "/sign-up"}>{signup ? "Sign in" : "Create account"}</a></p>
    </div>
  </main>;
}

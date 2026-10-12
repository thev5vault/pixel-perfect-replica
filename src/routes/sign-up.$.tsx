import { SignUp } from "@clerk/react";
import { createFileRoute } from "@tanstack/react-router";
import { AuthFrame } from "@/components/vault/AuthFrame";
import { authRedirectForIntent } from "@/lib/auth-routing";

export const Route = createFileRoute("/sign-up/$")({ component: SignUpPage });

function SignUpPage() {
  const redirect = typeof window === "undefined" ? "/dashboard" : authRedirectForIntent(window.location.search);
  const workshopIntent = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("intent") === "workshop";
  return <AuthFrame mode="sign-up" title={workshopIntent ? "Create Verified Workshop Account — Start 30-Day Free Trial (£9.99/mo)" : undefined}><SignUp routing="path" path="/sign-up" signInUrl="/sign-in" forceRedirectUrl={redirect} fallbackRedirectUrl={redirect} /></AuthFrame>;
}

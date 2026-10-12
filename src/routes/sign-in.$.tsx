import { SignIn } from "@clerk/react";
import { createFileRoute } from "@tanstack/react-router";
import { AuthFrame } from "@/components/vault/AuthFrame";
import { authRedirectForIntent } from "@/lib/auth-routing";

export const Route = createFileRoute("/sign-in/$")({ component: SignInPage });

function SignInPage() {
  const redirect = typeof window === "undefined" ? "/dashboard" : authRedirectForIntent(window.location.search);
  return <AuthFrame mode="sign-in"><SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" forceRedirectUrl={redirect} fallbackRedirectUrl={redirect} /></AuthFrame>;
}


import { SignIn } from "@clerk/react";
import { createFileRoute } from "@tanstack/react-router";
import { AuthFrame } from "@/components/vault/AuthFrame";

export const Route = createFileRoute("/sign-in/$")({ component: SignInPage });

function SignInPage() {
  return <AuthFrame mode="sign-in"><SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" forceRedirectUrl="/dashboard" fallbackRedirectUrl="/dashboard" /></AuthFrame>;
}


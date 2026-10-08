import { SignUp } from "@clerk/react";
import { createFileRoute } from "@tanstack/react-router";
import { AuthFrame } from "@/components/vault/AuthFrame";

export const Route = createFileRoute("/sign-up/$")({ component: SignUpPage });

function SignUpPage() {
  return <AuthFrame mode="sign-up"><SignUp routing="path" path="/sign-up" signInUrl="/sign-in" forceRedirectUrl="/dashboard" fallbackRedirectUrl="/dashboard" /></AuthFrame>;
}

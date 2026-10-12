import { SignIn, SignUp } from "@clerk/react";
import { createFileRoute } from "@tanstack/react-router";
import { AuthFrame } from "@/components/vault/AuthFrame";

export const Route = createFileRoute("/auth/$persona/$")({ component: PersonaAuthPage });

function PersonaAuthPage() {
  const { persona } = Route.useParams();
  const workshop = persona === "workshop";
  const base = workshop ? "/auth/workshop" : "/auth/driver";
  const signUp = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mode") === "signup";
  const redirect = workshop ? "/workshop/setup" : "/vehicle";
  const signInUrl = base;
  const signUpUrl = `${base}?mode=signup`;

  return <AuthFrame mode={signUp ? "sign-up" : "sign-in"} signInUrl={signInUrl} signUpUrl={signUpUrl}>
    {signUp
      ? <SignUp routing="path" path={base} signInUrl={signInUrl} forceRedirectUrl={redirect} fallbackRedirectUrl={redirect} />
      : <SignIn routing="path" path={base} signUpUrl={signUpUrl} forceRedirectUrl={redirect} fallbackRedirectUrl={redirect} />}
  </AuthFrame>;
}

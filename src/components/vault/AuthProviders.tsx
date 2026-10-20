import type { ReactNode } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { ClerkProvider } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { dark } from "@clerk/themes";
import { AccountProvider } from "@/lib/account-store";
import { SignupRecovery } from "./SignupRecovery";
import { SessionRestoreScreen } from "./SessionRestoreScreen";

// The themes package permits undefined cssLayerName; React's strict appearance
// type does not. We don't use a CSS layer, so omit that optional property.
const { cssLayerName: _unusedLayer, ...darkTheme } = dark;
function BrowserProviders({children}:{children:ReactNode}) {
  const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env["VITE_CLERK_PUBLISHABLE_KEY"]);
  const clerkProxyUrl = import.meta.env["VITE_CLERK_PROXY_URL"];
  const isWorkshopAuth = window.location.pathname.startsWith("/auth/workshop") || new URLSearchParams(window.location.search).get("intent") === "workshop";
  const isPersonaAuth = window.location.pathname.startsWith("/auth/");
  const isSignup = new URLSearchParams(window.location.search).get("mode") === "signup" || window.location.pathname.startsWith("/sign-up");
  const authTitle = isPersonaAuth
    ? isWorkshopAuth
      ? isSignup ? "Verified Workshop Terminal Portal — 30-Day Free Trial (£9.99/mo)" : "Sign in to Verified Workshop Terminal Portal"
      : isSignup ? "Create Driver Account" : "Sign in to Driver Glovebox"
    : isWorkshopAuth && isSignup
      ? "Create Verified Workshop Account — Start 30-Day Free Trial (£9.99/mo)"
      : undefined;
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl}
    signInUrl={isWorkshopAuth ? "/auth/workshop" : "/auth/driver"} signUpUrl={isWorkshopAuth ? "/auth/workshop?mode=signup" : "/auth/driver?mode=signup"}
    signInForceRedirectUrl="/dashboard" signUpForceRedirectUrl="/dashboard"
    localization={{
      signIn: { start: { title: authTitle && isPersonaAuth && !isSignup ? authTitle : "Sign in to V5Vault", titleCombined: authTitle && isPersonaAuth && !isSignup ? authTitle : "Sign in to V5Vault", subtitle: isWorkshopAuth ? "Access your workshop terminal & service logging dashboard." : "Access your V5Vault vehicle passport." } },
      signUp: { start: { title: authTitle && isSignup ? authTitle : "Create your V5Vault account", titleCombined: authTitle && isSignup ? authTitle : "Create your V5Vault account", subtitle: "Keep your vehicle history with V5Vault." } },
    }}
    appearance={{
      theme: darkTheme,
      variables: {
        colorPrimary: "#00d8f6",
        colorBackground: "#0f172a",
        colorInput: "#020617",
        colorForeground: "#e2e8f0",
        borderRadius: "1rem",
      },
      elements: {
        rootBox: { width: "100%" },
        cardBox: { width: "100%", background: "transparent", boxShadow: "none", borderRadius: "1rem" },
        card: { width: "100%", maxWidth: "28rem", margin: "0 auto", borderRadius: "1rem", border: "1px solid #1e293b", backgroundColor: "rgba(15,23,42,0.95)", padding: "clamp(1rem, 4vw, 1.5rem)", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" },
        headerTitle: { fontSize: "20px", fontWeight: 700, color: "#ffffff" },
        headerSubtitle: { fontSize: "14px", color: "#94a3b8" },
        socialButtonsBlockButton: { backgroundColor: "#1e293b", color: "#ffffff", borderColor: "#334155", "&:hover": { backgroundColor: "#334155" } },
        formButtonPrimary: { backgroundColor: "#06b6d4", color: "#020617", fontWeight: 700, "&:hover": { backgroundColor: "#22d3ee" } },
        formFieldInput: { fontSize: "16px" },
        otpCodeFieldInput: { fontSize: "16px" },
        footer: { display: "none" },
      },
    }}>
    <SignupRecovery><AccountProvider>{children}</AccountProvider></SignupRecovery>
  </ClerkProvider>;
}
export function AuthProviders({children}:{children:ReactNode}) {
  return <ClientOnly fallback={<SessionRestoreScreen />}>
    <BrowserProviders>{children}</BrowserProviders>
  </ClientOnly>;
}

import type { ReactNode } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { ClerkProvider } from "@clerk/react";
import { dark } from "@clerk/themes";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { AccountProvider } from "@/lib/account-store";
import { SignupRecovery } from "./SignupRecovery";

// The themes package permits undefined cssLayerName; React's strict appearance
// type does not. We don't use a CSS layer, so omit that optional property.
const { cssLayerName: _unusedLayer, ...darkTheme } = dark;
function BrowserProviders({children}:{children:ReactNode}) {
  const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env["VITE_CLERK_PUBLISHABLE_KEY"]);
  const clerkProxyUrl = import.meta.env["VITE_CLERK_PROXY_URL"];
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl}
    signInForceRedirectUrl="/" signUpForceRedirectUrl="/"
    localization={{
      signIn: { start: { title: "Sign in to V5Vault", titleCombined: "Sign in to V5Vault" } },
      signUp: { start: { title: "Create your V5Vault account", titleCombined: "Create your V5Vault account" } },
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
        card: { width: "100%", maxWidth: "28rem", margin: "0 auto", borderRadius: "1rem", border: "1px solid #1e293b", backgroundColor: "rgba(15,23,42,0.95)", padding: "1.5rem", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)" },
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
  return <ClientOnly fallback={<div className="flex h-[100dvh] items-center justify-center bg-slate-950 text-slate-400">Loading V5Vault…</div>}>
    <BrowserProviders>{children}</BrowserProviders>
  </ClientOnly>;
}

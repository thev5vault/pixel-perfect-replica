import type { ReactNode } from "react";
import { ClientOnly } from "@tanstack/react-router";
import { ClerkProvider } from "@clerk/react";
import { dark } from "@clerk/themes";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { AccountProvider } from "@/lib/account-store";

// The themes package permits undefined cssLayerName; React's strict appearance
// type does not. We don't use a CSS layer, so omit that optional property.
const { cssLayerName: _unusedLayer, ...darkTheme } = dark;
function BrowserProviders({children}:{children:ReactNode}) {
  const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env["VITE_CLERK_PUBLISHABLE_KEY"]);
  const clerkProxyUrl = import.meta.env["VITE_CLERK_PROXY_URL"];
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl}
    appearance={{theme:darkTheme,variables:{colorPrimary:"#00d8f6",colorBackground:"#0f172a",colorInput:"#020617",colorForeground:"#e2e8f0",borderRadius:"0.8rem"},
      elements:{cardBox:"shadow-none w-full",card:"border border-slate-800 shadow-none",formButtonPrimary:"text-slate-950",footerActionLink:"text-cyan-400"}}}>
    <AccountProvider>{children}</AccountProvider>
  </ClerkProvider>;
}
export function AuthProviders({children}:{children:ReactNode}) {
  return <ClientOnly fallback={<div className="flex h-[100dvh] items-center justify-center bg-slate-950 text-slate-400">Loading V5Vault…</div>}>
    <BrowserProviders>{children}</BrowserProviders>
  </ClientOnly>;
}

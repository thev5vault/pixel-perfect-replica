export const DEFAULT_CHECKOUT_RETURN_URL = "/settings?tab=plans";

export function resolveCheckoutReturnUrl(value: unknown, origin: string): string {
  if (typeof value !== "string" || value.length > 2048 || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return DEFAULT_CHECKOUT_RETURN_URL;
  }

  try {
    const base = new URL(origin);
    const target = new URL(value, base);
    if (target.origin !== base.origin || target.pathname === "/checkout/success") return DEFAULT_CHECKOUT_RETURN_URL;
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return DEFAULT_CHECKOUT_RETURN_URL;
  }
}

export function buildCheckoutSuccessUrl(origin: string, returnUrl: string): string {
  return `${origin.replace(/\/+$/, "")}/checkout/success?session_id={CHECKOUT_SESSION_ID}&return_url=${encodeURIComponent(returnUrl)}`;
}

export function buildCheckoutCancelUrl(origin: string, returnUrl: string): string {
  return `${origin.replace(/\/+$/, "")}${returnUrl}`;
}

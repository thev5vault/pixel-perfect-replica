import type { AccountState } from "./account-types";

export function isAuthEntry(path: string) {
  return path === "/" || path === "/dashboard" || /^\/(?:sign-(in|up)|auth\/(?:driver|workshop))(\/|$)/.test(path);
}

export function shouldHoldAuthEntryForHydration(path: string, authLoaded: boolean | undefined, initialHydrationResolved = false) {
  return !initialHydrationResolved && path !== "/" && isAuthEntry(path) && authLoaded === false;
}

export function signInRouteForPrivatePath(path: string): "/auth/driver" | "/auth/workshop" | "/sign-in" {
  if (path === "/admin" || path.startsWith("/admin/")) return "/sign-in";
  if (
    path === "/garage" ||
    path.startsWith("/garage/") ||
    path === "/workshop" ||
    path.startsWith("/workshop/") ||
    path === "/queue" ||
    path.startsWith("/queue/") ||
    path === "/bookings" ||
    path.startsWith("/bookings/") ||
    path === "/account" ||
    path.startsWith("/account/")
  ) return "/auth/workshop";
  return "/auth/driver";
}

export function authRedirectForIntent(search: string): "/vehicle" | "/workshop/setup" | "/dashboard" {
  const intent = new URLSearchParams(search).get("intent");
  if (intent === "owner") return "/vehicle";
  if (intent === "workshop") return "/workshop/setup";
  return "/dashboard";
}

export function accountHome(state: AccountState): "/admin" | "/garage" | "/vehicle" {
  if (state.user.role === "dev_admin") return "/admin";
  if (state.user.role === "verified_garage" || state.development_role === "Garage") return "/garage";
  return "/vehicle";
}

import type { AccountState } from "./account-types";

export function isAuthEntry(path: string) {
  return path === "/" || /^\/sign-(in|up)(\/|$)/.test(path);
}
export function accountHome(state: AccountState): "/admin" | "/garage" | "/vehicle" {
  if (state.user.role === "dev_admin") return "/admin";
  if (state.user.role === "verified_garage" || state.development_role === "Garage") return "/garage";
  return "/vehicle";
}

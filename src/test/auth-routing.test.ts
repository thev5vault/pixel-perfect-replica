import { describe, expect, it } from "vitest";
import { shouldHoldAuthEntryForHydration } from "@/lib/auth-routing";

describe("auth entry hydration", () => {
  it("holds the post-auth dashboard while Clerk restores a session", () => {
    expect(shouldHoldAuthEntryForHydration("/dashboard", false)).toBe(true);
  });

  it("holds sign-in and email-verification routes until Clerk is ready", () => {
    expect(shouldHoldAuthEntryForHydration("/sign-in", false)).toBe(true);
    expect(shouldHoldAuthEntryForHydration("/sign-up/verify-email-address", false)).toBe(true);
  });

  it("keeps the public landing page fast and does not block app pages", () => {
    expect(shouldHoldAuthEntryForHydration("/", false)).toBe(false);
    expect(shouldHoldAuthEntryForHydration("/", true)).toBe(false);
    expect(shouldHoldAuthEntryForHydration("/vehicle", false)).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { shouldHoldAuthEntryForHydration, signInRouteForPrivatePath } from "@/lib/auth-routing";

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

  it("does not show the restore screen again after initial hydration", () => {
    expect(shouldHoldAuthEntryForHydration("/auth/driver", false, true)).toBe(false);
  });

  it("selects the matching sign-in route for private owner, workshop and admin pages", () => {
    expect(signInRouteForPrivatePath("/vehicle")).toBe("/auth/driver");
    expect(signInRouteForPrivatePath("/vault")).toBe("/auth/driver");
    expect(signInRouteForPrivatePath("/garage")).toBe("/auth/workshop");
    expect(signInRouteForPrivatePath("/workshop/setup")).toBe("/auth/workshop");
    expect(signInRouteForPrivatePath("/admin")).toBe("/sign-in");
  });
});

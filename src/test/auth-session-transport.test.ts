import { describe, expect, it } from "vitest";
import { hasClerkSessionCredential } from "@/services/server/auth-transport";

describe("Clerk session credential detection", () => {
  it("skips Clerk auth when an unauthenticated request has no session cookie", () => {
    expect(hasClerkSessionCredential(new Request("https://v5vault.test/sign-in"))).toBe(false);
  });

  it("recognizes a Clerk session cookie without parsing or trusting its value", () => {
    const request = new Request("https://v5vault.test/api/account", {
      headers: { cookie: "theme=dark; __session=untrusted-cookie-value" },
    });
    expect(hasClerkSessionCredential(request)).toBe(true);
  });

  it("recognizes server-supplied bearer credentials", () => {
    const request = new Request("https://v5vault.test/api/account", {
      headers: { authorization: "Bearer untrusted-token" },
    });
    expect(hasClerkSessionCredential(request)).toBe(true);
  });
});

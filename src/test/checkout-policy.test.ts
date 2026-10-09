import { describe, expect, it } from "vitest";
import { assertCheckoutAccess } from "@/services/server/checkout-access";

describe("SuperAdmin Stripe test checkout policy", () => {
  it("allows an explicit God Mode checkout only in Stripe test mode", () => {
    expect(() => assertCheckoutAccess("dev_admin", true, true)).not.toThrow();
    expect(() => assertCheckoutAccess("dev_admin", false, true)).not.toThrow();
    expect(() => assertCheckoutAccess("dev_admin", true, false)).toThrow(/test mode/i);
  });

  it("does not let sample preview or non-admin accounts request test checkout", () => {
    expect(() => assertCheckoutAccess("civilian", true, true)).toThrow(/SuperAdmin/i);
    expect(() => assertCheckoutAccess("civilian", false, false)).not.toThrow();
  });
});

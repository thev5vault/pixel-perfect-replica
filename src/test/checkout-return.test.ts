import { describe, expect, it } from "vitest";
import {
  buildCheckoutCancelUrl,
  buildCheckoutSuccessUrl,
  DEFAULT_CHECKOUT_RETURN_URL,
  resolveCheckoutReturnUrl,
} from "@/lib/checkout-return";

describe("checkout return destinations", () => {
  it("preserves the initiating page, query, and hash", () => {
    expect(resolveCheckoutReturnUrl("/settings?tab=plans#billing", "https://v5vault.test"))
      .toBe("/settings?tab=plans#billing");
  });

  it("rejects external and malformed redirect targets", () => {
    expect(resolveCheckoutReturnUrl("https://attacker.test/collect", "https://v5vault.test"))
      .toBe(DEFAULT_CHECKOUT_RETURN_URL);
    expect(resolveCheckoutReturnUrl("//attacker.test/collect", "https://v5vault.test"))
      .toBe(DEFAULT_CHECKOUT_RETURN_URL);
  });

  it("builds success and cancellation URLs using the same local return target", () => {
    const returnUrl = "/account?tab=plans";
    expect(buildCheckoutSuccessUrl("https://v5vault.test", returnUrl))
      .toBe("https://v5vault.test/checkout/success?session_id={CHECKOUT_SESSION_ID}&return_url=%2Faccount%3Ftab%3Dplans");
    expect(buildCheckoutCancelUrl("https://v5vault.test", returnUrl))
      .toBe("https://v5vault.test/account?tab=plans");
  });
});

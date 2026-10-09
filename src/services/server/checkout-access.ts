import type { AccountRole } from "@/lib/account-types";

export function assertCheckoutAccess(role: AccountRole, testCheckout: boolean, stripeTestMode: boolean) {
  if (testCheckout && role !== "dev_admin") {
    throw new Error("A verified SuperAdmin account is required for Stripe test checkout.");
  }
  if (role === "dev_admin" && !stripeTestMode) {
    throw new Error("SuperAdmin Stripe checkout is only available while Stripe is in test mode.");
  }
}

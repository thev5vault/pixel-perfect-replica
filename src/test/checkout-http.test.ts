import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkout } from "@/services/server/billing";
import { handleCheckoutPost } from "@/services/server/checkout-http";

vi.mock("@/services/server/billing", () => ({ checkout: vi.fn() }));

const mockedCheckout = vi.mocked(checkout);

describe("Stripe checkout POST handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCheckout.mockResolvedValue({
      url: "https://checkout.stripe.com/c/pay/cs_test_example",
      preview: false,
      message: "Stripe Checkout session created.",
    });
  });

  it("accepts checkout requests and returns Stripe's hosted URL", async () => {
    const response = await handleCheckoutPost(new Request("https://v5vault.test/api/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "diy_monthly", returnUrl: "/settings?tab=plans" }),
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      url: "https://checkout.stripe.com/c/pay/cs_test_example",
      preview: false,
      message: "Stripe Checkout session created.",
    });
    expect(mockedCheckout).toHaveBeenCalledWith({ plan: "diy_monthly", returnUrl: "/settings?tab=plans" });
  });

  it("rejects unsupported checkout plans before invoking billing", async () => {
    const response = await handleCheckoutPost(new Request("https://v5vault.test/api/create-checkout-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "god_mode" }),
    }));
    expect(response.status).toBe(400);
    expect(mockedCheckout).not.toHaveBeenCalled();
  });
});

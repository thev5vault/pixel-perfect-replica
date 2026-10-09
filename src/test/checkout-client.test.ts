import { afterEach, describe, expect, it, vi } from "vitest";
import { startCheckout } from "@/services/v1Api";

describe("checkout client transport", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts to the same-origin checkout API with session cookies enabled", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      url: "https://checkout.stripe.com/c/pay/cs_test_example",
      preview: false,
      message: "Checkout created.",
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    await startCheckout({ data: { plan: "diy_monthly", testCheckout: true } });

    expect(fetchMock).toHaveBeenCalledWith("/api/create-checkout-session", expect.objectContaining({
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: "diy_monthly", testCheckout: true }),
    }));
  });
});

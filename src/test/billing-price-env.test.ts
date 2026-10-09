import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PLAN_DEFINITIONS } from "@/lib/plans";

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  retrieve: vi.fn(),
}));

vi.mock("@/services/server/db", () => ({
  pool: { query: mocks.query },
  inTransaction: (run: (db: { query: typeof mocks.query }) => unknown) => run({ query: mocks.query }),
}));

vi.mock("@/services/server/stripe-client", () => ({
  initializeStripe: vi.fn().mockResolvedValue(undefined),
  stripeClient: () => ({ prices: { retrieve: mocks.retrieve } }),
  stripeSync: vi.fn(),
  stripeTestMode: vi.fn().mockResolvedValue(true),
}));

import { catalog } from "@/services/server/billing";

const PRICE_ENV_NAMES = [
  "STRIPE_PRICE_CERTIFIED_PACK",
  "STRIPE_PRICE_PRO_DIY_MONTHLY",
  "STRIPE_PRICE_PRO_DIY_YEARLY",
  "STRIPE_PRICE_PRO_MODDER_MONTHLY",
  "STRIPE_PRICE_PRO_MODDER_YEARLY",
  "STRIPE_PRICE_WORKSHOP_MONTHLY",
  "STRIPE_PRICE_WORKSHOP_YEARLY",
];

describe("Stripe price ID environment mapping", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const name of PRICE_ENV_NAMES) vi.stubEnv(name, "");
    vi.stubEnv("STRIPE_PRICE_WORKSHOP_MONTHLY", "price_test_workshop_monthly");
    vi.stubEnv("STRIPE_PRICE_WORKSHOP_YEARLY", "price_test_workshop_yearly");
    mocks.query.mockResolvedValue({ rows: [] });
    mocks.retrieve.mockImplementation(async (priceId: string) => {
      const key = priceId.endsWith("yearly") ? "workshop_yearly" : "workshop_monthly";
      const definition = PLAN_DEFINITIONS[key];
      return {
        id: priceId,
        active: true,
        livemode: false,
        currency: "gbp",
        unit_amount: definition.amount,
        recurring: { interval: definition.interval },
      };
    });
  });

  afterEach(() => vi.unstubAllEnvs());

  it("recognizes the explicit Verified Workshop monthly and yearly Stripe price IDs", async () => {
    const result = await catalog();
    expect(result.preview).toBe(false);
    expect(result.prices).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "workshop_monthly", price_id: "price_test_workshop_monthly", amount_pence: 999 }),
      expect.objectContaining({ key: "workshop_yearly", price_id: "price_test_workshop_yearly", amount_pence: 9999 }),
    ]));
    expect(mocks.retrieve).toHaveBeenCalledWith("price_test_workshop_monthly");
    expect(mocks.retrieve).toHaveBeenCalledWith("price_test_workshop_yearly");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { PLAN_DEFINITIONS, PLAN_KEYS } from "@/lib/plans";
import { TierPlans } from "@/components/vault/TierPlans";

const { mockV1 } = vi.hoisted(() => ({
  mockV1: {
    preview: false,
    getCatalog: vi.fn(),
    checkout: vi.fn(),
    billingPortal: vi.fn(),
  },
}));

vi.mock("@/lib/use-v1", () => ({ useV1: () => mockV1 }));

describe("subscription plan cards", () => {
  beforeEach(() => {
    mockV1.getCatalog.mockReset().mockResolvedValue({
      test_mode: true,
      prices: PLAN_KEYS.map((key) => ({
        key,
        name: PLAN_DEFINITIONS[key].name,
        amount_pence: PLAN_DEFINITIONS[key].amount,
        currency: "gbp" as const,
        interval: PLAN_DEFINITIONS[key].interval,
        price_id: `price_${key}`,
      })),
    });
    mockV1.checkout.mockReset().mockResolvedValue({ url: null, preview: true, message: "Sample preview" });
    mockV1.billingPortal.mockReset().mockResolvedValue({ url: null, preview: true, message: "No billing profile" });
  });

  it("shows exactly four plan cards and selects the matching annual Stripe plan", async () => {
    const { container } = render(<TierPlans />);
    expect(await screen.findByRole("heading", { name: "Basic Driver (Free)" })).toBeInTheDocument();
    expect(container.querySelectorAll("article")).toHaveLength(4);
    expect(screen.getAllByRole("button", { name: "Choose plan" })).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: "Yearly (Save ~16%)" }));
    const diy = screen.getByRole("heading", { name: "Pro DIY" }).closest("article")!;
    const modder = screen.getByRole("heading", { name: "Pro Modder / Collector" }).closest("article")!;
    const workshop = screen.getByRole("heading", { name: "Verified Workshop / Garage Pro" }).closest("article")!;
    expect(diy).toHaveTextContent(/£9\.99\s*\/\s*year/);
    expect(modder).toHaveTextContent(/£14\.99\s*\/\s*year/);
    expect(workshop).toHaveTextContent(/£99\.99\s*\/\s*year/);

    fireEvent.click(within(modder).getByRole("button", { name: "Choose plan" }));
    expect(mockV1.checkout).toHaveBeenCalledWith("pro_yearly", undefined, "year");
  });
});

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";
import { TimelineItem } from "@/components/vault/TimelineItem";
import { VaultProvider, type ServiceRecord } from "@/lib/vault-store";
import { Route as HomeRoute } from "@/routes/index";

const Dashboard = HomeRoute.options.component!;

const service: ServiceRecord = {
  id: "test-service",
  vrm: "AB14CDE",
  date: "2025-03-08",
  mileage: 85340,
  category: "Brakes",
  description: "Brake replacement",
  items: [],
  cost: 642,
  partsCost: 468,
  labourCost: 174,
  garage: "Apex Performance Ltd",
  verified: true,
  image: "/receipt.jpg",
  parts: [{ name: "Front discs", partNo: "Brembo 09.C401.13" }],
};

describe("Pro DIY entitlements", () => {
  beforeEach(() => localStorage.clear());

  it("masks service details and opens an upgrade prompt for the free tier", async () => {
    const { container } = render(
      <VaultProvider>
        <TimelineItem s={service} />
      </VaultProvider>,
    );

    expect(screen.getByText("Brembo 09.C401.13")).toHaveClass("blur-[4px]");
    expect(screen.getByRole("button", { name: /upgrade to pro diy to view receipt photo/i })).toBeInTheDocument();
    expect(container.querySelector("img")?.className).toContain("blur-[4px]");
    expect(screen.queryByText("Parts £468.00 · Labour £174.00")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /upgrade to pro diy.*for part numbers/i }));
    expect(await screen.findByText("Upgrade to Pro DIY (£0.99/mo) for part numbers.")).toBeInTheDocument();
  });

  it("reveals part numbers, receipt photos and itemized costs to Pro DIY", async () => {
    localStorage.setItem("v5vault:v1", JSON.stringify({ role: "DIY" }));

    const { container } = render(
      <VaultProvider>
        <TimelineItem s={service} />
      </VaultProvider>,
    );

    await waitFor(() => expect(screen.getByRole("button", { name: "View Brake replacement receipt" })).toBeInTheDocument());
    expect(screen.getByText("Brembo 09.C401.13")).not.toHaveClass("blur-[4px]");
    expect(container.querySelector("img")?.className).not.toContain("blur-[4px]");
    expect(screen.getByText("Parts £468.00 · Labour £174.00")).toBeInTheDocument();
    expect(screen.getByText("£642.00")).toBeInTheDocument();
  });

  it("opens the Pro DIY receipt upgrade instead of the free-tier entry form", async () => {
    render(
      <VaultProvider>
        <Dashboard />
      </VaultProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /snap receipt/i }));
    expect(await screen.findByText("Upgrade to Pro DIY (£0.99/mo) to upload receipts.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Snap Receipt" })).not.toBeInTheDocument();
  });
});

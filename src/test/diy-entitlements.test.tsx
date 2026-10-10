import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";
import { TimelineItem } from "@/components/vault/TimelineItem";
import { VaultProvider, type ServiceRecord } from "@/lib/vault-store";
import { Dashboard } from "@/routes/index";

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
  fluids: "Castrol Edge 5W-30 LL 4.6L",
};

describe("Pro DIY entitlements", () => {
  beforeEach(() => localStorage.clear());

  it("masks service details and opens an upgrade prompt for the free tier", async () => {
    const { container } = render(
      <VaultProvider>
        <TimelineItem s={service} />
      </VaultProvider>,
    );

    expect(screen.getByText("Brembo 09.C401.13")).toHaveClass("blur-sm", "select-none", "opacity-40", "text-slate-400");
    expect(screen.getByText("Castrol Edge 5W-30 LL 4.6L")).toHaveClass("blur-sm", "font-mono");
    expect(screen.getByText("Fluid specs")).not.toHaveClass("blur-sm");
    expect(screen.getByRole("button", { name: /upgrade to pro diy to view receipt photo/i })).toBeInTheDocument();
    expect(container.querySelector("img")?.className).toContain("blur-[4px]");
    expect(screen.queryByText("Parts £468.00 · Labour £174.00")).not.toBeInTheDocument();

    const unlockButton = screen.getByRole("button", { name: /Unlock Itemized Parts & Fluid Specs.*£0.99\/mo/i });
    expect(screen.getAllByRole("button", { name: /unlock itemized oem parts and fluid specifications/i })).toHaveLength(1);
    expect(screen.getAllByText("Unlock Itemized Parts & Fluid Specs (£0.99/mo)")).toHaveLength(1);
    expect(screen.queryByText(/Upgrade to Pro DIY.*for part numbers/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /unlock itemized oem parts and fluid specifications/i }));
    expect(await screen.findByText("Upgrade to Pro DIY (£0.99/mo) for itemized parts and fluid specifications.")).toBeInTheDocument();
    expect(unlockButton).toBeInTheDocument();
  });

  it("reveals part numbers, receipt photos and itemized costs to Pro DIY", async () => {
    localStorage.setItem("v5vault:v1", JSON.stringify({ role: "DIY" }));

    const { container } = render(
      <VaultProvider>
        <TimelineItem s={service} />
      </VaultProvider>,
    );

    await waitFor(() => expect(screen.getByRole("button", { name: "View Brake replacement receipt" })).toBeInTheDocument());
    expect(screen.getByText("Brembo 09.C401.13")).not.toHaveClass("blur-sm");
    expect(screen.getByText("Castrol Edge 5W-30 LL 4.6L")).not.toHaveClass("blur-sm");
    expect(container.querySelector("img")?.className).not.toContain("blur-[4px]");
    expect(screen.getByText("Parts cost").parentElement).toHaveTextContent("£468.00");
    expect(screen.getByText("Labour cost").parentElement).toHaveTextContent("£174.00");
    expect(screen.getByText("£642.00")).toBeInTheDocument();
  });

  it("lets Free users open the service-entry form with uploads while keeping itemized fields locked", async () => {
    render(
      <VaultProvider>
        <Dashboard />
      </VaultProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /snap receipt/i }));
    expect(await screen.findByRole("heading", { name: "Snap Receipt" })).toBeInTheDocument();
    expect(screen.getByText("RECEIPT PHOTO")).toBeInTheDocument();
    expect(screen.getByText("INVOICE PDF")).toBeInTheDocument();
    expect(screen.getByText("Photo / Image")).toBeInTheDocument();
    expect(screen.getByText("PDF Document")).toBeInTheDocument();
    expect(screen.getByText("RECEIPT PHOTO").closest(".grid")).toHaveClass("grid-cols-2");
    expect(screen.getByRole("button", { name: /oem part numbers & fluid specs/i })).toBeInTheDocument();
  });

  it("opens a separate editable DIY form with quick chips and optional proof uploads", async () => {
    render(
      <VaultProvider>
        <Dashboard />
      </VaultProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /add a basic diy service entry/i }));
    expect(await screen.findByRole("heading", { name: "Add a Basic DIY Service Entry" })).toBeInTheDocument();
    const workField = screen.getByLabelText("Work performed");
    expect(workField).toBeEnabled();
    expect(screen.getByText("Optional receipt photo · available on every plan")).toBeInTheDocument();
    expect(screen.getByText("Optional invoice PDF · available on every plan")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Oil & filter" }));
    expect(workField).toHaveValue("Oil & filter");
    expect(screen.queryByText(/OEM part numbers/i)).not.toBeInTheDocument();
  });

  it("does not treat imported client-side verified flags as a workshop stamp", () => {
    render(<VaultProvider><TimelineItem s={{...service, tier3:true}} /></VaultProvider>);
    expect(screen.getByText("Owner Logged / DIY Record")).toBeInTheDocument();
    expect(screen.queryByText(/VAT Reg Verified/)).not.toBeInTheDocument();
  });
  it("shows a locked receipt teaser without exposing a redacted image", () => {
    const {container}=render(<VaultProvider><TimelineItem s={{...service,image:undefined,has_receipt:true}} /></VaultProvider>);
    expect(screen.getByRole("button",{name:/upgrade to pro diy to view receipt photo/i})).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".blur-\\[4px\\]")).not.toBeNull();
  });
});

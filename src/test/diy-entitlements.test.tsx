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

    expect(screen.queryByText("Brembo 09.C401.13")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Details ˅" }));
    expect(screen.getByRole("button", { name: "Hide Details ˄" })).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: "Details ˅" }));
    expect(screen.getByText("Brembo 09.C401.13")).not.toHaveClass("blur-sm");
    expect(screen.getByText("Castrol Edge 5W-30 LL 4.6L")).not.toHaveClass("blur-sm");
    expect(container.querySelector("img")?.className).not.toContain("blur-[4px]");
    expect(screen.getByText("Parts Cost").parentElement).toHaveTextContent("£468.00");
    expect(screen.getByText("Labour Cost").parentElement).toHaveTextContent("£174.00");
    expect(screen.getByText("£642.00")).toBeInTheDocument();
  });

  it("lets Free users open the service-entry form with uploads while keeping itemized fields locked", async () => {
    render(
      <VaultProvider>
        <Dashboard />
      </VaultProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: /Snap Receipt/i }));
    expect(await screen.findByRole("heading", { name: "Snap Receipt" })).toBeInTheDocument();
    expect(screen.getByText("RECEIPT PHOTO")).toBeInTheDocument();
    expect(screen.getByText("INVOICE PDF")).toBeInTheDocument();
    expect(screen.getByText("Invoice total (£) · optional")).toBeInTheDocument();
    expect(screen.queryByText("Parts (£)")).not.toBeInTheDocument();
    expect(screen.queryByText("Labour (£)")).not.toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("button", { name: /Add DIY Service Entry/i }));
    expect(await screen.findByRole("heading", { name: "Add a Basic DIY Service Entry" })).toBeInTheDocument();
    const workField = screen.getByLabelText("Work performed");
    expect(workField).toBeEnabled();
    expect(screen.queryByText(/AI Auto-Scan \(Receipt, Invoice, Logbook\)/)).not.toBeInTheDocument();
    expect(screen.getByText("Optional receipt photo")).toBeInTheDocument();
    expect(screen.getByText("Optional invoice PDF")).toBeInTheDocument();
    expect(screen.getByLabelText("Photo / Image").closest(".grid")).toHaveClass("grid-cols-2", "gap-3");
    expect(screen.getByLabelText("PDF Document")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Oil & filter" }));
    expect(workField).toHaveValue("Oil & filter");
    expect(screen.queryByText(/OEM part numbers/i)).not.toBeInTheDocument();
  });

  it("groups all Pro DIY invoice costs in a three-column row", async () => {
    localStorage.setItem("v5vault:v1", JSON.stringify({ role: "DIY" }));
    render(<VaultProvider><Dashboard /></VaultProvider>);

    fireEvent.click(screen.getByRole("button", { name: /Snap Receipt/i }));
    await screen.findByRole("heading", { name: "Snap Receipt" });

    const total = screen.getByText("Invoice total (£)");
    const parts = screen.getByText("Parts (£)");
    const labour = screen.getByText("Labour (£)");
    const grid = total.closest(".grid");
    expect(grid).toHaveClass("grid-cols-3", "gap-2.5");
    expect(grid).toContainElement(parts);
    expect(grid).toContainElement(labour);
  });

  it("does not treat imported client-side verified flags as a workshop stamp", () => {
    render(<VaultProvider><TimelineItem s={{...service, tier3:true}} /></VaultProvider>);
    expect(screen.getByText("Apex Performance Ltd")).toBeInTheDocument();
    expect(screen.queryByText("Verified Workshop Stamp")).not.toBeInTheDocument();
    expect(screen.queryByText(/VAT Reg Verified/)).not.toBeInTheDocument();
  });

  it("keeps the garage name in its own sub-row and hides empty breakdown controls", () => {
    const { rerender } = render(<VaultProvider><TimelineItem s={service} /></VaultProvider>);
    expect(screen.getAllByText("Apex Performance Ltd")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Details ˅" })).toBeInTheDocument();

    rerender(<VaultProvider><TimelineItem s={{...service, items:[], parts:[], fluids:undefined, partsCost:0, labourCost:0, cost:undefined, image:undefined, has_receipt:false, has_invoice:false}} /></VaultProvider>);
    expect(screen.queryByRole("button", { name: /Details/ })).not.toBeInTheDocument();
  });

  it("keeps sample workshop stamps while removing verification debug badges", () => {
    render(<VaultProvider><TimelineItem s={{...service, is_verified_stamp:true, is_sample:true}} /></VaultProvider>);
    expect(screen.getByText("Sample Workshop")).toBeInTheDocument();
    expect(screen.getByText("Brakes")).toBeInTheDocument();
    expect(screen.queryByText(/Development sample · VAT not live verified/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Verify$/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Signed$/)).not.toBeInTheDocument();
  });

  it("shows a locked receipt teaser without exposing a redacted image", () => {
    const {container}=render(<VaultProvider><TimelineItem s={{...service,image:undefined,has_receipt:true}} /></VaultProvider>);
    expect(screen.getByRole("button",{name:/upgrade to pro diy to view receipt photo/i})).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".blur-\\[4px\\]")).not.toBeNull();
  });
});

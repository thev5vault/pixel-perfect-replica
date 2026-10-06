import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { VaultProvider, useVault } from "@/lib/vault-store";
import { Route as PassportRoute } from "@/routes/passport";
import { Route as HomeRoute } from "@/routes/index";
import { VehicleLookupDialog } from "@/components/vault/VehicleLookupDialog";
import { AppErrorBoundary } from "@/components/vault/AppErrorBoundary";
import { Route as VaultRoute } from "@/routes/vault";
import { UpgradeDialog } from "@/components/vault/UpgradeDialog";
import { V5VaultLogo } from "@/components/vault/V5VaultLogo";

vi.mock("@/services/dvlaApi", () => ({ lookupVehicle: vi.fn(async () => ({
  vehicle: { vrm: "BUL200", make: "VW", model: "Golf", odometer: 100, v5cDate: "", motExpiry: "", motHistory: [], source: "demo" },
  notice: "Sample vehicle attached — demo data",
})) }));
vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: () => <div aria-label="Mileage graph" />,
  CartesianGrid: () => null, Line: () => null, Tooltip: () => null, XAxis: () => null, YAxis: () => null,
}));

const Passport = PassportRoute.options.component!;
const Dashboard = HomeRoute.options.component!;
const Vault = VaultRoute.options.component!;

describe("V1 polish", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("renders the transparent cyan double-V shield mark", () => {
    const { container } = render(<V5VaultLogo />);
    const logo = container.querySelector("svg");
    expect(logo).toHaveAttribute("viewBox", "0 0 100 100");
    expect(logo).toHaveClass("object-contain", "w-8", "h-8");
    expect(logo?.querySelectorAll("path")).toHaveLength(3);
    expect(logo?.querySelector("path")).toHaveAttribute("stroke", "#00D8F6");
    expect(logo?.querySelector("path")).toHaveAttribute("d", "M 50 14 L 84 27 V 57 L 50 88 L 16 57 V 27 Z");
    expect(logo?.querySelector("path")).toHaveAttribute("stroke-linejoin", "miter");
    expect(container.querySelector("img")).toBeNull();
  });

  it.each([
    ["Owner", "Standard Passport", false, false],
    ["DIY", "OEM Provenance Certificate", true, false],
    ["Pro", "Master Build Sheet", true, true],
  ])("stacks %s certificate sections cumulatively", async (role, name, oem, master) => {
    localStorage.setItem("v5vault:v1", JSON.stringify({ role }));
    vi.useFakeTimers();
    const { container } = render(<VaultProvider><Passport /></VaultProvider>);
    fireEvent.click(screen.getByRole("button", { name: new RegExp(name) }));
    await act(async () => { vi.advanceTimersByTime(1100); });
    const doc = container.querySelector(".passport-document")!;
    expect(doc).toHaveTextContent("DVLA Mileage Progression");
    expect(doc).toHaveTextContent("Service History");
    expect(doc).toHaveTextContent("MOT & Mileage Log");
    expect(doc).toHaveTextContent("Scan to Verify Authenticity");
    expect(doc.textContent?.includes("Manufacturer reference")).toBe(oem);
    expect(doc.textContent?.includes("Active Build Spec")).toBe(master);
    expect(doc.textContent?.includes("Reverted / Removed Modifications")).toBe(master);
    expect(doc.querySelector("button")?.closest(".print\\:hidden")).not.toBeNull();
  });

  it("keeps the receipt header and Save footer outside the padded scrolling form", () => {
    localStorage.setItem("v5vault:v1", JSON.stringify({ role: "DIY" }));
    render(<VaultProvider><Dashboard /></VaultProvider>);
    fireEvent.click(screen.getByRole("button", { name: /snap receipt/i }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("overflow-hidden");
    expect(dialog.querySelector("header")).toHaveClass("sticky", "top-0");
    const body = dialog.querySelector(".pb-6")!;
    expect(body).toHaveClass("overflow-y-auto", "flex-1", "min-h-0");
    expect(body).not.toContainElement(screen.getByRole("button", { name: "Save to Timeline" }));
    expect(dialog).toHaveClass("max-h-[90dvh]", "flex-col", "rounded-t-3xl");
    expect(screen.getByRole("button", { name: "Save to Timeline" }).closest("footer")).toHaveClass("sticky", "bottom-0");
    fireEvent.click(screen.getByRole("button", { name: "Date" }));
    const calendar = screen.getByRole("dialog", { name: "" });
    expect(calendar).toHaveClass("bg-slate-900", "z-[100]");
  });

  it("attaches a looked-up vehicle from the yellow plate modal", async () => {
    function Probe() {
      const { vehicle } = useVault();
      return <><p data-testid="active">{vehicle.vrm}</p><VehicleLookupDialog open onOpenChange={() => {}} /></>;
    }
    render(<VaultProvider><Probe /></VaultProvider>);
    fireEvent.change(screen.getByLabelText("Registration number"), { target: { value: "bul 200" } });
    expect(screen.getByLabelText("Registration number")).toHaveValue("BUL 200");
    fireEvent.click(screen.getByRole("button", { name: "Lookup Vehicle" }));
    await act(async () => {});
    expect(screen.getByTestId("active")).toHaveTextContent("BUL200");
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("contains render failures with a recovery screen", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    function Broken(): React.ReactNode { throw new Error("Test render failure"); }
    render(<AppErrorBoundary><Broken /></AppErrorBoundary>);
    expect(screen.getByRole("alert")).toHaveTextContent("This view couldn’t be displayed");
    expect(screen.getByRole("button", { name: "Reload app" })).toBeInTheDocument();
    logged.mockRestore();
  });

  it("keeps modification actions outside the scroll body without oversized padding", () => {
    localStorage.setItem("v5vault:v1", JSON.stringify({ role: "Pro" }));
    render(<VaultProvider><Vault /></VaultProvider>);
    fireEvent.click(screen.getByRole("button", { name: /add mod/i }));
    const dialog = screen.getByRole("dialog");
    expect(dialog.querySelector("header")).toHaveClass("flex-none", "bg-slate-900");
    const save = screen.getByRole("button", { name: "Add to Active Build" });
    expect(save.closest("footer")).toHaveClass("flex-none", "bottom-0");
    expect(dialog.querySelector(".pb-6")).not.toContainElement(save);
    expect(dialog.querySelector(".pb-6")?.querySelector("textarea")).toBeInTheDocument();
  });

  it("keeps upgrade actions pinned below scrollable perks", () => {
    render(<UpgradeDialog open onOpenChange={() => {}} />);
    const dialog = screen.getByRole("dialog");
    const upgrade = screen.getByRole("button", { name: "Upgrade to Pro DIY (£0.99/mo)" });
    expect(upgrade.closest("footer")).toHaveClass("flex-none", "bottom-0");
    expect(dialog.querySelector(".pb-6")).not.toContainElement(upgrade);
    expect(dialog.parentElement).toHaveClass("items-end", "sm:items-center", "overscroll-none");
  });
});

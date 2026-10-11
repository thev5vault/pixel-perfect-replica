import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { VaultProvider, useVault } from "@/lib/vault-store";
import { Route as PassportRoute } from "@/routes/passport";
import { Dashboard } from "@/routes/index";
import { VehicleLookupDialog } from "@/components/vault/VehicleLookupDialog";
import { AppErrorBoundary } from "@/components/vault/AppErrorBoundary";
import { Route as VaultRoute } from "@/routes/vault";
import { UpgradeDialog } from "@/components/vault/UpgradeDialog";
import { V5VaultLogo } from "@/components/vault/V5VaultLogo";

const accountMocks = vi.hoisted(() => ({ displayPreference: "easy" as "easy" | "detailed" }));
vi.mock("@/lib/account-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/account-store")>();
  return {
    ...actual,
    useAccount: () => ({ displayPreference: accountMocks.displayPreference } as ReturnType<typeof actual.useAccount>),
  };
});

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
const Vault = VaultRoute.options.component!;

describe("V1 polish", () => {
  beforeEach(() => { localStorage.clear(); accountMocks.displayPreference = "easy"; });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it("renders the official blended V5Vault logo image", () => {
    const { container } = render(<V5VaultLogo />);
    const logo = screen.getByRole("img", { name: "V5Vault Logo" });
    expect(logo).toHaveAttribute("src", "/logo.png");
    expect(logo).toHaveClass("object-contain", "mix-blend-screen", "w-8", "h-8");
    expect(container.querySelector("svg")).toBeNull();
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
    expect(doc).toHaveTextContent("No signed workshop stamp to verify");
    expect(doc).toHaveTextContent("Development sample document");
    expect(doc).not.toHaveTextContent("https://v5vault.app/p/");
    expect(doc.querySelectorAll(".passport-record-list").length).toBeGreaterThanOrEqual(2);
    expect(doc.querySelector(".passport-table-scroll")).toBeNull();
    expect(doc.querySelector("table")).toBeNull();
    expect(doc.querySelector(".passport-record-card")).not.toBeNull();
    expect(doc.textContent?.includes("Manufacturer reference")).toBe(oem);
    expect(doc.textContent?.includes("Financial Summary")).toBe(oem);
    expect(doc.textContent?.includes("Active Build Spec")).toBe(master);
    expect(doc.textContent?.includes("Reverted / Removed Modifications")).toBe(master);
    expect(doc.querySelector("button")?.closest(".print\\:hidden")).not.toBeNull();
  });

  it("condenses empty passport history and omits zero-value certificate cards", async () => {
    localStorage.setItem("v5vault:v1", JSON.stringify({ role: "DIY", services: [] }));
    vi.useFakeTimers();
    const { container } = render(<VaultProvider><Passport /></VaultProvider>);
    fireEvent.click(screen.getByRole("button", { name: /OEM Provenance Certificate/ }));
    await act(async () => { vi.advanceTimersByTime(1100); });
    const doc = container.querySelector(".passport-document")!;
    expect(doc).toHaveTextContent("📄 No Service Records");
    expect(doc).toHaveTextContent("💰 Recorded Spend: £0.00");
    expect(doc).not.toHaveTextContent("Financial Summary");
    expect(doc).not.toHaveTextContent("No service records.");
  });

  it("links a passport QR to the actual stored workshop stamp", async () => {
    localStorage.setItem("v5vault:v1",JSON.stringify({
      role:"Owner",
      services:[{id:"signed-test",vrm:"AB14CDE",date:"2026-10-07",mileage:90301,category:"Servicing",description:"Oil & Filter",items:[],garage:"Sample Workshop",verified:true,is_verified_stamp:true,is_sample:true,stamp_signature:"v1.sample.test"}],
    }));
    vi.useFakeTimers();
    const {container}=render(<VaultProvider><Passport /></VaultProvider>);
    fireEvent.click(screen.getByRole("button",{name:/Standard Passport/}));
    await act(async()=>{vi.advanceTimersByTime(1100);});
    const doc=container.querySelector(".passport-document")!;
    expect(doc).toHaveTextContent("Scan to Verify Authenticity");
    expect(doc.querySelector("code")).toHaveTextContent(`${window.location.origin}/verify/signed-test`);
    expect(doc).toHaveTextContent("Development sample");
  });

  it("keeps the receipt header and Save footer outside the padded scrolling form", () => {
    localStorage.setItem("v5vault:v1", JSON.stringify({ role: "DIY" }));
    render(<VaultProvider><Dashboard /></VaultProvider>);
    fireEvent.click(screen.getByRole("button", { name: /Snap Receipt/i }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveClass("overflow-hidden");
    expect(dialog.querySelector("header")).toHaveClass("sticky", "top-0");
    const body = dialog.querySelector(".overflow-y-auto")!;
    expect(body).toHaveClass("overflow-y-auto", "flex-1", "min-h-0");
    expect(body).not.toContainElement(screen.getByRole("button", { name: "Save to Timeline" }));
    expect(dialog).toHaveClass("max-h-[var(--dialog-max-height,90dvh)]", "flex-col", "rounded-2xl", "p-5");
    expect(screen.getByRole("button", { name: "Save to Timeline" }).closest("footer")).toHaveClass("sticky", "bottom-0");
    fireEvent.click(screen.getByRole("button", { name: "Date" }));
    const calendar = screen.getByRole("dialog", { name: "" });
    expect(calendar).toHaveClass("bg-slate-900", "z-[100]");
  });

  it("shows a clear empty service state without a duplicate zero-value spend row", () => {
    localStorage.setItem("v5vault:v1", JSON.stringify({ role: "DIY", services: [] }));
    render(<VaultProvider><Dashboard /></VaultProvider>);

    expect(screen.getByText("📄 No Service Records")).toBeInTheDocument();
    expect(screen.queryByText(/Recorded Spend: £0\.00/)).not.toBeInTheDocument();
    expect(screen.queryByText("Recorded spend")).not.toBeInTheDocument();
    expect(screen.queryByText(/Engine size not returned|Tax status not returned/)).not.toBeInTheDocument();

    const scan = screen.getByRole("button", { name: /Snap Receipt/i });
    const repair = screen.getByRole("button", { name: /Add DIY Service Entry/i });
    expect(scan.parentElement).toHaveClass("flex", "flex-col", "gap-2.5", "my-3", "sm:flex-row");
    expect(scan).toHaveClass("min-h-[44px]");
    expect(repair).toHaveClass("min-h-[44px]");
    expect(screen.getAllByRole("button", { name: /Snap Receipt/i })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: /Add DIY Service Entry/i })).toHaveLength(1);
  });

  it("combines empty service and MOT histories into one actionable placeholder", () => {
    localStorage.setItem("v5vault:v1", JSON.stringify({
      role: "DIY",
      services: [],
      activeVrm: "AB14CDE",
      vehicles: [{
        vrm: "AB14CDE",
        make: "Audi",
        model: "A4",
        odometer: 87420,
        v5cDate: "2019-03-15",
        motExpiry: "2026-11-18",
        year: 2014,
        fuelType: "Diesel",
        motHistory: [],
        source: "demo",
      }],
    }));
    render(<VaultProvider><Dashboard /></VaultProvider>);

    expect(screen.getByRole("heading", { name: "No Maintenance Records Saved Yet" })).toBeInTheDocument();
    expect(screen.getByText(/Use "Snap Receipt" above to auto-scan an invoice or "Add DIY Entry" to log self-servicing/)).toBeInTheDocument();
    const emptyState = screen.getByRole("heading", { name: "No Maintenance Records Saved Yet" }).closest("section")!;
    expect(within(emptyState).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Snap Receipt/ })).toHaveClass("min-h-[44px]");
    expect(screen.getByRole("button", { name: /Add DIY Service Entry/ })).toHaveClass("min-h-[44px]");
    expect(screen.queryByRole("heading", { name: "Service History" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: /MOT History/ })).not.toBeInTheDocument();
  });

  it("collapses service history after three records and shows one end-of-timeline spend summary", () => {
    const services = [0, 1, 2, 3].map((index) => ({
      id: `service-${index}`,
      vrm: "AB14CDE",
      date: `2026-10-0${4 - index}`,
      mileage: 87000 + index * 100,
      category: "Servicing",
      description: `Service record ${index + 1}`,
      items: [],
      garage: "Owner logged DIY",
      verified: false,
      is_verified_stamp: false,
      cost: 25,
      partsCost: 10,
      labourCost: 15,
    }));
    localStorage.setItem("v5vault:v1", JSON.stringify({ role: "DIY", services }));
    const { container } = render(<VaultProvider><Dashboard /></VaultProvider>);

    expect(container.querySelectorAll("ol > li")).toHaveLength(3);
    const expand = screen.getByRole("button", { name: /View All Service Records \(Showing 3 of 4\)/ });
    fireEvent.click(expand);
    expect(container.querySelectorAll("ol > li")).toHaveLength(4);
    expect(screen.getByRole("button", { name: /Collapse Service Records/ })).toHaveAttribute("aria-expanded", "true");

    const summaries = screen.getAllByRole("region", { name: "Timeline spend summary" });
    expect(summaries).toHaveLength(1);
    expect(within(summaries[0]!).getByText("Total")).toBeInTheDocument();
    expect(within(summaries[0]!).getByText("£100")).toBeInTheDocument();
    expect(within(summaries[0]!).getByText("Parts")).toBeInTheDocument();
    expect(within(summaries[0]!).getByText("£40")).toBeInTheDocument();
    expect(within(summaries[0]!).getByText("Labour")).toBeInTheDocument();
    expect(within(summaries[0]!).getByText("£60")).toBeInTheDocument();
  });

  it("animates the Easy View specifications accordion", () => {
    render(<VaultProvider><Dashboard /></VaultProvider>);
    const healthCards = within(screen.getByTestId("vehicle-health-cards"));
    expect(healthCards.getByText("Servicing")).toBeInTheDocument();
    expect(healthCards.getByText("MOT Status")).toBeInTheDocument();
    expect(healthCards.queryByText("Brakes")).not.toBeInTheDocument();
    const toggle = screen.getByRole("button", { name: /view full specifications/i });
    const accordion = screen.getByTestId("vehicle-specifications-accordion");
    expect(accordion).toHaveClass("duration-300", "ease-in-out", "grid-rows-[0fr]");
    fireEvent.click(toggle);
    expect(screen.getByRole("button", { name: /hide full specifications/i })).toHaveAttribute("aria-expanded", "true");
    expect(accordion).toHaveClass("grid-rows-[1fr]");
  });

  it("shows the complete specification grid and brake card in Detailed View", () => {
    accountMocks.displayPreference = "detailed";
    localStorage.setItem("v5vault:v1", JSON.stringify({
      role: "DIY",
      activeVrm: "AB14CDE",
      vehicles: [{
        vrm: "AB14CDE",
        make: "Audi",
        model: "A4",
        odometer: 87420,
        v5cDate: "2019-03-15",
        motExpiry: "2026-11-18",
        year: 2014,
        fuelType: "Diesel",
        vin: "WAUZZZ8K9AA000001",
        motHistory: [],
        source: "demo",
      }],
    }));
    render(<VaultProvider><Dashboard /></VaultProvider>);

    const specifications = within(screen.getByTestId("vehicle-specifications-accordion"));
    expect(specifications.getByText("Odometer")).toBeInTheDocument();
    expect(specifications.getByText("Engine Specs")).toBeInTheDocument();
    expect(specifications.getByText("First Registered")).toBeInTheDocument();
    expect(specifications.getByText("Transmission")).toBeInTheDocument();
    expect(specifications.getByText("VIN Provenance")).toBeInTheDocument();
    expect(within(screen.getByTestId("vehicle-health-cards")).getByText("Brakes")).toBeInTheDocument();
  });

  it("attaches a looked-up vehicle from the yellow plate modal", async () => {
    function Probe() {
      const { vehicle } = useVault();
      return <><p data-testid="active">{vehicle.vrm}</p><VehicleLookupDialog open onOpenChange={() => {}} /></>;
    }
    render(<VaultProvider><Probe /></VaultProvider>);
    fireEvent.change(screen.getByLabelText("Vehicle registration mark"), { target: { value: "bul 200" } });
    expect(screen.getByLabelText("Vehicle registration mark")).toHaveValue("BUL 200");
    fireEvent.click(screen.getByRole("button", { name: "Connect vehicle passport" }));
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
    expect(dialog.querySelector("header")).toHaveClass("flex-none", "bg-transparent");
    expect(dialog).toHaveClass("bg-slate-950", "p-5", "rounded-2xl", "gap-4");
    const installDate = screen.getByLabelText("Install Date");
    expect(installDate).toHaveClass("appearance-none", "[-webkit-appearance:none]", "h-11", "border-slate-700/70");
    expect(installDate.closest("[data-modal-field]")).toHaveClass("flex", "flex-col", "min-w-0");
    const save = screen.getByRole("button", { name: "Add to Active Build" });
    expect(save.closest("footer")).toHaveClass("flex-none", "bottom-0");
    expect(dialog.querySelector(".overflow-y-auto")).not.toContainElement(save);
    expect(dialog.querySelector(".overflow-y-auto")?.querySelector("textarea")).toBeInTheDocument();
  });

  it("keeps upgrade actions pinned below scrollable perks", () => {
    render(<UpgradeDialog open onOpenChange={() => {}} />);
    const dialog = screen.getByRole("dialog");
    const upgrade = screen.getByRole("button", { name: "Continue to Stripe · £0.99/mo" });
    expect(upgrade.closest("footer")).toHaveClass("flex-none", "bottom-0");
    expect(dialog.querySelector(".pb-6")).not.toContainElement(upgrade);
    expect(dialog.parentElement).toHaveClass("items-end", "sm:items-center", "overscroll-none");
  });
});

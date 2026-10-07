import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useVault, type Modification } from "@/lib/vault-store";
import { Route } from "@/routes/vault";

vi.mock("@/lib/vault-store", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/vault-store")>(),
  useVault: vi.fn(),
}));

const Vault = Route.options.component!;

function renderVault(mods: unknown) {
  vi.mocked(useVault).mockReturnValue({
    role: "Pro",
    vehicle: { vrm: "AB14CDE" },
    mods,
    addMod: vi.fn(),
    revertMod: vi.fn(),
  } as unknown as ReturnType<typeof useVault>);
  render(<Vault />);
}

describe("Diagnostic History", () => {
  it.each([undefined, null, [], { legacy: true }])("shows an empty state safely for %j records", (mods) => {
    renderVault(mods);
    fireEvent.click(screen.getByRole("button", { name: "Diagnostic History" }));
    expect(screen.getByText("No diagnostic fault codes or scan logs recorded yet.")).toHaveClass(
      "p-6", "bg-slate-900/60", "border-slate-800", "rounded-xl",
    );
    fireEvent.click(screen.getByRole("button", { name: "Active Build" }));
    expect(screen.getByText("No active modifications. Your car is running stock.")).toBeInTheDocument();
  });

  it("keeps existing diagnostic history scoped to the selected vehicle", () => {
    const record: Modification = {
      id: "reverted-intake",
      vrm: "AB14CDE",
      name: "Reverted intake",
      category: "Intake",
      status: "reverted",
      installDate: "2025-01-01",
      installMileage: 80000,
      notes: "Removed after a P0101 scan.",
      gains: "",
    };
    renderVault([record, { ...record, id: "other-car", vrm: "OTHER", name: "Other vehicle part" }]);
    fireEvent.click(screen.getByRole("button", { name: "Diagnostic History" }));
    expect(screen.getByRole("heading", { name: "Reverted intake" })).toBeInTheDocument();
    expect(screen.getByText("Removed after a P0101 scan.")).toBeInTheDocument();
    expect(screen.queryByText("Other vehicle part")).not.toBeInTheDocument();
    expect(screen.queryByText("No diagnostic fault codes or scan logs recorded yet.")).not.toBeInTheDocument();
  });
});

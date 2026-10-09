import type { UserAccount } from "@/lib/account-types";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountSettings } from "@/components/vault/AccountSettings";

const mocks = vi.hoisted(() => ({
  account: null as object | null,
  saveProfile: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/account-store", () => ({ useAccount: () => mocks.account }));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));
vi.mock("@/components/vault/PasskeySettings", () => ({
  PasskeySettings: () => <div>Passkey settings</div>,
}));
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/settings#plans-access">{children}</a>
  ),
}));

function makeUser(overrides: Partial<UserAccount> = {}): UserAccount {
  return {
    id: "user-1",
    email: "driver@example.test",
    full_name: "Driver One",
    role: "civilian",
    subscription_tier: "free",
    stripe_customer_id: null,
    created_at: "2026-01-01T00:00:00Z",
    garage_verified: false,
    garage_name: "",
    garage_registration: "",
    status: "pending",
    is_sample: false,
    ...overrides,
  };
}

function renderSettings(user: UserAccount) {
  mocks.account = {
    state: { user },
    preview: false,
    error: null,
    saveProfile: mocks.saveProfile,
  };
  return render(<AccountSettings />);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.saveProfile.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

describe("account settings tier-driven profile", () => {
  it("always shows Display Name and offers the workshop upgrade to consumer accounts", () => {
    renderSettings(makeUser());

    expect(screen.getByLabelText("Display Name")).toHaveValue("Driver One");
    expect(screen.getByText("Active Role: Private Driver (Basic Driver (Free))")).toBeInTheDocument();
    expect(screen.queryByText("WORKSHOP & TRADE DETAILS")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Trading/Business Name")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Company Reg / VAT Number")).not.toBeInTheDocument();
    expect(screen.getByText(
      "Want to stamp digital service logs? Upgrade to Verified Workshop (£9.99/mo)",
    )).toHaveAttribute("href", "/settings#plans-access");
  });

  it("shows the editable trade section only for verified workshop accounts", () => {
    renderSettings(makeUser({
      role: "verified_garage",
      subscription_tier: "verified_garage",
      subscription_status: "active",
      status: "approved",
      garage_verified: true,
      vat_verified: true,
      garage_name: "Northside Motors",
      garage_registration: "GB123456789",
      workshop_type: "specialist",
    }));

    expect(screen.getByLabelText("Display Name")).toBeInTheDocument();
    expect(screen.getByText("WORKSHOP & TRADE DETAILS")).toBeInTheDocument();
    expect(screen.getByLabelText("Trading/Business Name")).toHaveValue("Northside Motors");
    expect(screen.getByLabelText("Company Reg / VAT Number")).toHaveValue("GB123456789");
    expect(screen.getByLabelText("Workshop type")).toHaveValue("specialist");
    expect(screen.queryByText(/Upgrade to Verified Workshop/)).not.toBeInTheDocument();
  });

  it("hides all workshop fields and the upgrade callout for administrator accounts", () => {
    renderSettings(makeUser({
      role: "dev_admin",
      subscription_tier: "god_mode",
      permissions: ["all_access"],
      garage_name: "Hidden sample workshop",
      garage_registration: "SAMPLE-ONLY",
    }));

    expect(screen.getByText(
      "Role: Platform Founder & Lead Developer (God Mode Active)",
    )).toBeInTheDocument();
    expect(screen.queryByText("WORKSHOP & TRADE DETAILS")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Trading/Business Name")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Company Reg / VAT Number")).not.toBeInTheDocument();
    expect(screen.queryByText(/Upgrade to Verified Workshop/)).not.toBeInTheDocument();
  });

  it("saves only the display name for consumers and includes trade details for workshops", async () => {
    const { unmount } = renderSettings(makeUser());
    fireEvent.change(screen.getByLabelText("Display Name"), { target: { value: "New Driver" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() => expect(mocks.saveProfile).toHaveBeenLastCalledWith({ full_name: "New Driver" }));

    unmount();
    renderSettings(makeUser({
      role: "verified_garage",
      subscription_tier: "verified_garage",
      subscription_status: "active",
      status: "approved",
      garage_verified: true,
      vat_verified: true,
    }));
    fireEvent.change(screen.getByLabelText("Display Name"), { target: { value: "Workshop Owner" } });
    fireEvent.change(screen.getByLabelText("Trading/Business Name"), { target: { value: "Northside Motors" } });
    fireEvent.change(screen.getByLabelText("Company Reg / VAT Number"), { target: { value: "GB123456789" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() => expect(mocks.saveProfile).toHaveBeenLastCalledWith({
      full_name: "Workshop Owner",
      garage_name: "Northside Motors",
      garage_registration: "GB123456789",
      workshop_type: "garage",
    }));
    expect(mocks.toastSuccess).toHaveBeenCalledTimes(2);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { PasskeySignInButton } from "@/components/vault/PasskeySignInButton";
import { PasskeySettings } from "@/components/vault/PasskeySettings";
import { PasskeyClientError } from "@/services/passkeyClient";

const mocks = vi.hoisted(() => ({
  authenticateWithPasskey: vi.fn(),
  registerPasskey: vi.fn(),
  getRegisteredPasskeyCount: vi.fn(),
  toastError: vi.fn(),
  toastInfo: vi.fn(),
  toastSuccess: vi.fn(),
  onAuthenticated: vi.fn(),
  PasskeyClientError: class extends Error {
    code?: string;
    constructor(message: string, code?: string) {
      super(message);
      this.name = "PasskeyClientError";
      if (code !== undefined) this.code = code;
    }
  },
}));

vi.mock("@/services/passkeyClient", () => ({
  authenticateWithPasskey: mocks.authenticateWithPasskey,
  registerPasskey: mocks.registerPasskey,
  getRegisteredPasskeyCount: mocks.getRegisteredPasskeyCount,
  PasskeyClientError: mocks.PasskeyClientError,
}));
vi.mock("@/lib/account-store", () => ({
  useAccount: () => ({
    preview: false, signedIn: true,
    state: { user: { id: "owner", email_verified: true } },
  }),
}));
vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, info: mocks.toastInfo, success: mocks.toastSuccess },
}));

function enableWebAuthn() {
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  Object.defineProperty(window, "PublicKeyCredential", { configurable: true, value: class PublicKeyCredential {} });
  Object.defineProperty(navigator, "credentials", {
    configurable: true,
    value: { get: vi.fn(), create: vi.fn() },
  });
}

describe("native WebAuthn passkey flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enableWebAuthn();
    mocks.authenticateWithPasskey.mockResolvedValue({ status: "complete", createdSessionId: "sess_test" });
    mocks.registerPasskey.mockResolvedValue(1);
    mocks.getRegisteredPasskeyCount.mockResolvedValue(0);
  });
  afterEach(() => cleanup());

  it("runs the native passkey flow without creating a Clerk passkey session", async () => {
    render(<PasskeySignInButton onAuthenticated={mocks.onAuthenticated} />);
    const button = screen.getByRole("button", { name: "Sign in with Face ID or Touch ID" });
    expect(button.textContent).not.toMatch(/simulation/i);
    fireEvent.click(button);

    await waitFor(() => expect(mocks.authenticateWithPasskey).toHaveBeenCalledTimes(1));
    expect(mocks.onAuthenticated).toHaveBeenCalledTimes(1);
  });

  it("reports passkey sign-in when the browser does not support WebAuthn", () => {
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: false });
    render(<PasskeySignInButton />);
    fireEvent.click(screen.getByRole("button", { name: "Sign in with Face ID or Touch ID" }));
    expect(mocks.authenticateWithPasskey).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith("Passkeys require a compatible browser and a secure connection.");
  });

  it("shows the account-settings hint when no passkey is available", async () => {
    mocks.authenticateWithPasskey.mockRejectedValue(new PasskeyClientError("No credentials are registered.", "NO_PASSKEYS_REGISTERED"));
    render(<PasskeySignInButton />);
    fireEvent.click(screen.getByRole("button", { name: "Sign in with Face ID or Touch ID" }));
    await waitFor(() => expect(mocks.toastInfo).toHaveBeenCalledWith(
      "No Face ID linked yet. Please sign in and register Face ID in Account Settings.",
    ));
  });

  it("registers a passkey from account settings through V5Vault's verified backend", async () => {
    render(<PasskeySettings />);
    fireEvent.click(screen.getByRole("button", { name: "Register Face ID / Add Passkey" }));
    await waitFor(() => expect(mocks.registerPasskey).toHaveBeenCalledTimes(1));
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Passkey added. Use Face ID / Touch ID to sign in.");
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { PasskeySignInButton } from "@/components/vault/PasskeySignInButton";
import { PasskeySettings } from "@/components/vault/PasskeySettings";

const mocks = vi.hoisted(() => ({
  authenticateWithPasskey: vi.fn(),
  setActive: vi.fn(),
  createPasskey: vi.fn(),
  reload: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@clerk/react/legacy", () => ({
  useSignIn: () => ({
    isLoaded: true,
    signIn: { authenticateWithPasskey: mocks.authenticateWithPasskey },
    setActive: mocks.setActive,
  }),
}));
vi.mock("@clerk/react", () => ({
  useUser: () => ({
    isLoaded: true,
    user: {
      passkeys: [],
      createPasskey: mocks.createPasskey,
      reload: mocks.reload,
    },
  }),
}));
vi.mock("@/lib/account-store", () => ({
  useAccount: () => ({ preview: false, state: { user: { email_verified: true } } }),
}));
vi.mock("sonner", () => ({
  toast: { error: mocks.toastError, success: mocks.toastSuccess },
}));

function enableWebAuthn() {
  Object.defineProperty(window, "isSecureContext", { configurable: true, value: true });
  Object.defineProperty(window, "PublicKeyCredential", { configurable: true, value: class PublicKeyCredential {} });
  Object.defineProperty(navigator, "credentials", {
    configurable: true,
    value: { get: vi.fn(), create: vi.fn() },
  });
}

describe("Clerk passkey flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enableWebAuthn();
    mocks.authenticateWithPasskey.mockResolvedValue({ status: "complete", createdSessionId: "sess_test" });
    mocks.setActive.mockResolvedValue(undefined);
    mocks.createPasskey.mockResolvedValue({});
    mocks.reload.mockResolvedValue(undefined);
  });
  afterEach(() => cleanup());

  it("authenticates with a discoverable WebAuthn passkey and activates the Clerk session", async () => {
    render(<PasskeySignInButton />);
    const button = screen.getByRole("button", { name: "Sign in with Face ID or Touch ID" });
    expect(button.textContent).not.toMatch(/simulation/i);
    fireEvent.click(button);

    await waitFor(() => expect(mocks.setActive).toHaveBeenCalled());
    expect(mocks.authenticateWithPasskey).toHaveBeenCalledWith({ flow: "discoverable" });
    expect(mocks.setActive).toHaveBeenCalledWith(expect.objectContaining({
      session: "sess_test",
      navigate: expect.any(Function),
    }));
  });

  it("reports passkey sign-in when the browser does not support WebAuthn", () => {
    Object.defineProperty(window, "isSecureContext", { configurable: true, value: false });
    render(<PasskeySignInButton />);
    fireEvent.click(screen.getByRole("button", { name: "Sign in with Face ID or Touch ID" }));
    expect(mocks.authenticateWithPasskey).not.toHaveBeenCalled();
    expect(mocks.toastError).toHaveBeenCalledWith("Passkeys require a compatible browser and a secure connection.");
  });

  it("enrolls a passkey from account settings using Clerk's user resource", async () => {
    render(<PasskeySettings />);
    fireEvent.click(screen.getByRole("button", { name: "Add a passkey on this device" }));
    await waitFor(() => expect(mocks.createPasskey).toHaveBeenCalled());
    expect(mocks.reload).toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalledWith("Passkey added. Use Face ID / Touch ID to sign in on this device.");
  });
});

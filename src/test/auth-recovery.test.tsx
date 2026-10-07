import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { PENDING_SIGNUP_KEY, pendingEmailFromSignup, readPendingSignup, savePendingSignup } from "@/lib/signup-recovery";
import { enhanceAuthInputs, watchAuthInputs } from "@/lib/auth-inputs";
import { SignupRecovery } from "@/components/vault/SignupRecovery";

const mocks = vi.hoisted(() => ({
  user: { isLoaded: true, isSignedIn: false },
  client: { signUp: {} as ReturnType<typeof pendingAttempt>, reload: vi.fn() },
  navigate: vi.fn(),
  subscribe: vi.fn(() => vi.fn()),
  info: vi.fn(), error: vi.fn(),
}));
vi.mock("@clerk/react", () => {
  const clerk = { client: mocks.client, addListener: mocks.subscribe };
  return { useUser: () => mocks.user, useClerk: () => clerk };
});
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => mocks.navigate }));
vi.mock("sonner", () => ({ toast: { info: mocks.info, error: mocks.error } }));

function pendingAttempt() {
  return { id: "test-attempt", status: "missing_requirements", emailAddress: "test@example.com",
    unverifiedFields: ["email_address"], verifications: { emailAddress: { strategy: "email_code", status: "unverified" } } };
}
function widget() { return render(<SignupRecovery><p>Existing Clerk widget</p></SignupRecovery>); }
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/");
  Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  mocks.user.isSignedIn = false;
  mocks.client.signUp = pendingAttempt();
  mocks.client.reload.mockResolvedValue(mocks.client);
  mocks.navigate.mockImplementation(({ params }: { params: { _splat: string } }) =>
    window.history.replaceState(null, "", `/sign-up/${params._splat}`));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("Email verification recovery", () => {
  it("stores only a short-lived UI hint, never passwords, OTPs, tokens or attempt IDs", () => {
    savePendingSignup(sessionStorage, "test@example.com");
    expect(Object.keys(JSON.parse(sessionStorage.getItem(PENDING_SIGNUP_KEY)!)).sort()).toEqual(["isVerifyingEmail", "pendingEmail", "updatedAt"]);
    expect(readPendingSignup(sessionStorage)?.pendingEmail).toBe("test@example.com");
    expect(readPendingSignup(sessionStorage, Date.now() + 3600001)).toBeNull();
  });
  it("uses server-side email-code state, not a marker, to decide whether verification exists", () => {
    expect(pendingEmailFromSignup(pendingAttempt())).toBe("test@example.com");
    expect(pendingEmailFromSignup({ ...pendingAttempt(), id: undefined })).toBeNull();
    expect(pendingEmailFromSignup({ ...pendingAttempt(), status: "complete" })).toBeNull();
    expect(pendingEmailFromSignup({ ...pendingAttempt(), verifications: { emailAddress: { strategy: null, status: null } } })).toBeNull();
  });
  it("restores the verification route on page reload without recreating the signup", async () => {
    savePendingSignup(sessionStorage, "test@example.com");
    widget();
    await screen.findByText("Existing Clerk widget");
    expect(mocks.client.reload).toHaveBeenCalledOnce();
    expect(window.location.pathname).toBe("/sign-up/verify-email-address");
  });
  it("refreshes the existing attempt when Safari returns, not while hidden", async () => {
    savePendingSignup(sessionStorage, "test@example.com");
    widget();
    await screen.findByText("Existing Clerk widget");
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(mocks.client.reload).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    await act(async () => { window.dispatchEvent(new Event("pageshow")); });
    expect(mocks.client.reload).toHaveBeenCalledTimes(2);
  });
  it("explains expired attempts instead of fabricating a verification session", async () => {
    savePendingSignup(sessionStorage, "test@example.com");
    mocks.client.reload.mockResolvedValue({ signUp: { ...pendingAttempt(), id: undefined, status: null } });
    widget();
    await screen.findByText("Existing Clerk widget");
    expect(sessionStorage.getItem(PENDING_SIGNUP_KEY)).toBeNull();
    expect(mocks.info).toHaveBeenCalledWith(expect.stringContaining("expired"));
    expect(window.location.pathname).toBe("/sign-up/");
  });
  it("keeps the recovery hint on a temporary network error and retries on focus", async () => {
    savePendingSignup(sessionStorage, "test@example.com");
    mocks.client.reload.mockRejectedValueOnce(new Error("offline"));
    widget();
    await screen.findByText("Existing Clerk widget");
    expect(readPendingSignup(sessionStorage)).not.toBeNull();
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(mocks.client.reload).toHaveBeenCalledTimes(2);
    expect(mocks.error).toHaveBeenCalledOnce();
  });
  it.each([401,404,410])("handles expired provider clients (%s) without a retry loop", async status => {
    savePendingSignup(sessionStorage,"test@example.com");
    mocks.client.reload.mockRejectedValue({status});
    widget();
    await screen.findByText("Existing Clerk widget");
    expect(sessionStorage.getItem(PENDING_SIGNUP_KEY)).toBeNull();
    expect(mocks.info).toHaveBeenCalledWith(expect.stringContaining("expired"));
    expect(mocks.error).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/sign-up/");
    await act(async()=>{window.dispatchEvent(new Event("focus"));});
    expect(mocks.client.reload).toHaveBeenCalledOnce();
  });
  it("clears the hint once authenticated", async () => {
    savePendingSignup(sessionStorage, "test@example.com");
    mocks.user.isSignedIn = true;
    widget();
    await screen.findByText("Existing Clerk widget");
    expect(sessionStorage.getItem(PENDING_SIGNUP_KEY)).toBeNull();
    expect(mocks.client.reload).not.toHaveBeenCalled();
  });
  it("does not crash when Safari denies sessionStorage access", async () => {
    window.history.replaceState(null, "", "/sign-up");
    vi.spyOn(window, "sessionStorage", "get").mockImplementation(() => { throw new DOMException("Blocked", "SecurityError"); });
    widget();
    await screen.findByText("Existing Clerk widget");
    expect(window.location.pathname).toBe("/sign-up/verify-email-address");
  });
});
describe("OTP input enhancement", () => {
  it("enforces native autofill/numeric attributes without changing any values", () => {
    const root = document.createElement("div");
    root.innerHTML = '<input name="email" type="email"><input type="password"><input class="cl-otpCodeFieldInput" value="123456">';
    enhanceAuthInputs(root);
    const code = root.querySelector<HTMLInputElement>(".cl-otpCodeFieldInput")!;
    expect(code.autocomplete).toBe("one-time-code");
    expect(code.inputMode).toBe("numeric");
    expect(code.value).toBe("123456");
    expect(root.querySelector<HTMLInputElement>('[name="email"]')?.inputMode).toBe("");
  });
  it("covers code fields mounted later or reset by the Clerk widget", async () => {
    const root = document.createElement("div");
    const disconnect = watchAuthInputs(root);
    const code = document.createElement("input");
    code.name = "code";
    root.append(code);
    await waitFor(() => expect(code.autocomplete).toBe("one-time-code"));
    code.inputMode = "text";
    await waitFor(() => expect(code.inputMode).toBe("numeric"));
    disconnect();
  });
});

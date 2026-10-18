import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SessionRestoreScreen } from "@/components/vault/SessionRestoreScreen";

describe("session restore screen", () => {
  it("uses one accessible, consistent status during auth hydration", () => {
    const { container } = render(<SessionRestoreScreen />);
    expect(screen.getByRole("status")).toHaveTextContent("Restoring session…");
    expect(container.querySelector(".auth-restore-screen")).toBeInTheDocument();
  });
});

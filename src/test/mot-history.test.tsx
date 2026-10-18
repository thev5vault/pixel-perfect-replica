import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MotHistory } from "@/components/vault/MotHistory";
import type { MotReading } from "@/lib/vault-store";

const readings: MotReading[] = [
  { date: "2026-03-01", result: "Pass" },
  { date: "2025-03-01", result: "Fail", defects: ["Brake pipe corroded (4.7.1 (b) (i))"] },
  { date: "2024-03-01", result: "Pass with advisories", advisories: ["Tyre worn (5.2.3 (e))"] },
  { date: "2023-03-01", result: "Pass" },
];

describe("MOT history accordion", () => {
  it("shows the three newest tests, result pills, and expands the full history", () => {
    render(<MotHistory readings={readings} official />);
    expect(screen.getByText("DVSA verified")).toBeInTheDocument();
    expect(screen.getAllByText("PASS")).toHaveLength(2);
    expect(screen.getByText("FAIL")).toBeInTheDocument();
    expect(screen.queryByText(/1 Mar 2023/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View All 4 Historic MOTs" }));
    expect(screen.getByText(/1 Mar 2023/)).toBeInTheDocument();
  });

  it("keeps findings collapsed and strips raw DVSA clause references", () => {
    render(<MotHistory readings={readings} />);
    expect(screen.getByText("Sample history")).toBeInTheDocument();
    const heading = screen.getAllByText("Advisories & Defects (1)")[0]!;
    const drawer = heading.closest("details");
    expect(drawer).not.toHaveAttribute("open");
    fireEvent.click(heading);
    expect(within(drawer!).getByText("Brake pipe corroded")).toBeVisible();
    expect(screen.queryByText(/4\.7\.1/)).not.toBeInTheDocument();
  });

  it("labels same-day failure and retest records distinctly", () => {
    render(<MotHistory readings={[
      { date: "2026-02-17", result: "Fail" },
      { date: "2026-02-17", result: "Pass" },
    ]} official />);
    expect(screen.getByText("INITIAL FAIL")).toBeInTheDocument();
    expect(screen.getByText("RE-TEST PASS")).toBeInTheDocument();
  });
});

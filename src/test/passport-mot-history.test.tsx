import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PassportMotHistory } from "@/components/PassportMotHistory";
import type { MotReading } from "@/lib/vault-store";

describe("Passport MOT history", () => {
  it("shows three recent tests and expands to the ordered full timeline", () => {
    const readings: MotReading[] = [
      { date: "2026-01-01", result: "Pass" },
      { date: "2026-03-01", result: "Pass" },
      { date: "2026-02-01", result: "Pass" },
      { date: "2026-04-10", result: "Pass" },
      { date: "2026-04-10", result: "Fail" },
    ];
    const { container } = render(<PassportMotHistory readings={readings} />);
    expect(container.querySelectorAll('[role="listitem"]')).toHaveLength(3);
    const list = screen.getByRole("list");
    expect(within(list).getAllByText("INITIAL FAIL")).toHaveLength(1);
    expect(within(list).getAllByText("RE-TEST PASS")).toHaveLength(1);
    const labels = [...container.querySelectorAll('[role="listitem"] span')].map((node) => node.textContent?.trim());
    expect(labels.slice(0, 2)).toEqual(["RE-TEST PASS", "INITIAL FAIL"]);
    const firstTwoDates = [...container.querySelectorAll('[role="listitem"] p.font-semibold')].map((node) => node.textContent);
    expect(firstTwoDates[0]).toContain("10 Apr 2026");
    expect(firstTwoDates[1]).toContain("10 Apr 2026");

    fireEvent.click(screen.getByRole("button", { name: "View All 5 Historic MOTs" }));
    expect(container.querySelectorAll('[role="listitem"]')).toHaveLength(5);
  });

  it("renders advisory clauses as sanitized indented bullets", () => {
    render(<PassportMotHistory readings={[{
      date: "2026-02-17",
      result: "Pass with advisories",
      advisories: ["minor: front brake disc worn (4.7.1 (b) (i)); tyre worn (5.2.3 (e))"],
    }]} />);
    expect(screen.getByText("Minor: front brake disc worn")).toBeInTheDocument();
    expect(screen.getByText("Tyre worn")).toBeInTheDocument();
    expect(screen.queryByText(/4\.7\.1|5\.2\.3/)).not.toBeInTheDocument();
  });

  it("keeps the progressive timeline and provenance label on public Passport views", () => {
    const readings: MotReading[] = Array.from({ length: 4 }, (_, index) => ({
      date: `2026-0${4 - index}-01`,
      result: "Pass",
    }));
    const { container } = render(<PassportMotHistory
      readings={readings}
      variant="public"
      title="MOT record"
      sourceLabel="DVSA record"
    />);
    expect(container.firstElementChild).toHaveClass("vault-card");
    expect(screen.getAllByText("DVSA record")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "View All 4 Historic MOTs" })).toBeInTheDocument();
  });
});

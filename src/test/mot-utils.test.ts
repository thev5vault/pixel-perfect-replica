import { describe, expect, it } from "vitest";
import { formatMotAdvisories } from "@/utils/motSanitizer";
import { sortMotTests } from "@/utils/motSorter";

describe("MOT data formatting", () => {
  it("strips statutory clause references, splits items, and capitalizes each item", () => {
    expect(formatMotAdvisories("minor: brake disc worn (4.7.1 (b) (i)); tyre worn\nlamp not working (1.1)"))
      .toEqual(["Minor: brake disc worn", "Tyre worn", "Lamp not working"]);
  });

  it("sorts newest first and places same-day initial failures before retest passes", () => {
    const tests = [
      { date: "2026-01-03", result: "Pass" },
      { date: "2026-02-17", result: "Pass" },
      { date: "2026-02-17", result: "Fail" },
      { date: "2025-12-01", result: "Fail" },
    ];
    expect(sortMotTests(tests).map(({ date, result }) => `${date} ${result}`)).toEqual([
      "2026-02-17 Fail",
      "2026-02-17 Pass",
      "2026-01-03 Pass",
      "2025-12-01 Fail",
    ]);
  });
});

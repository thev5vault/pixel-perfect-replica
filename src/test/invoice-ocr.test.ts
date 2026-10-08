import { describe, expect, it } from "vitest";
import { parseInvoiceText } from "@/services/invoice-ocr";

const categories = ["Servicing", "Brakes", "Tyres"] as const;
const components = ["Engine oil", "Oil filter", "Brake pads", "Tyres"] as const;

describe("local invoice text suggestions", () => {
  it("extracts explicit UK date, mileage, category, parts and labour without calculating totals", () => {
    const result = parseInvoiceText(
      [
        "Invoice date: 17/09/2025",
        "Odometer: 86,420 miles",
        "Brake pads fitted",
        "Parts: £48.50",
        "Labour: £65.00",
      ].join("\n"),
      categories,
      components,
    );

    expect(result).toEqual({
      date: "2025-09-17",
      mileage: "86420",
      category: "Brakes",
      components: ["Brake pads"],
      partsCost: "48.50",
      labourCost: "65.00",
      notes: "Brake pads fitted",
    });
  });

  it("recognizes a written UK date and known components", () => {
    const result = parseInvoiceText(
      "Service completed 17 September 2025\nEngine oil and oil filter replaced",
      categories,
      components,
    );

    expect(result.date).toBe("2025-09-17");
    expect(result.components).toEqual(["Engine oil", "Oil filter"]);
    expect(result.notes).toBe("Engine oil and oil filter replaced");
  });

  it("prefers a specific repair category over a generic service mention", () => {
    const result = parseInvoiceText(
      "General service check; brake pads replaced",
      categories,
      components,
    );
    expect(result.category).toBe("Brakes");
  });

  it("does not invent values from unrelated invoice text", () => {
    expect(parseInvoiceText("Thank you for your custom. Total paid: £113.50", categories, components)).toEqual({});
  });

  it("rejects invalid dates and out-of-range mileage", () => {
    const result = parseInvoiceText(
      "Invoice date: 31/02/2025\nMileage: 9,999,999",
      categories,
      components,
    );

    expect(result.date).toBeUndefined();
    expect(result.mileage).toBeUndefined();
  });
});

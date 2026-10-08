import { describe, expect, it } from "vitest";
import { expectedVINCheckDigit, normalizeVIN, validateVIN } from "@/lib/vin";
import { lookupMockRegistration } from "@/services/server/dvla";

describe("VIN identity validation", () => {
  it("accepts exactly 17 alphanumeric characters and normalizes case", () => {
    expect(validateVIN("WAUZZZ8K9EA000001")).toBe(true);
    expect(validateVIN("wauzzz8k9ea000001")).toBe(true);
    expect(normalizeVIN(" wauzzz8k9ea000001 ")).toBe("WAUZZZ8K9EA000001");
  });

  it.each(["WAUZZZ8K9EA00001", "WAUZZZ8K9EA0000011", "WAUZZZ8K9EI000001", "WAUZZZ8K9EO000001", "WAUZZZ8K9EQ000001", "WAU-ZZZ8K9EA00001"])(
    "rejects invalid VIN %s",
    vin => expect(validateVIN(vin)).toBe(false),
  );

  it("applies the ISO 3779 check digit to North American VINs without rejecting UK/European VINs", () => {
    const validNorthAmericanVin = "1M8GDM9AXKP042788";
    expect(expectedVINCheckDigit(validNorthAmericanVin)).toBe("X");
    expect(validateVIN(validNorthAmericanVin)).toBe(true);
    expect(validateVIN(`${validNorthAmericanVin.slice(0, 8)}9${validNorthAmericanVin.slice(9)}`)).toBe(false);
    expect(validateVIN("WUAZZZ8EX8A800721")).toBe(true);
  });
});

describe("Development sample vehicle lookup", () => {
  it("returns labelled demo specs with a valid VIN", () => {
    const result = lookupMockRegistration("AB14 CDE");
    expect(result.notice).toContain("demo sample");
    expect(result.notice).toContain("not an official");
    expect(result.vehicle.vin).toBe("WAUZZZ8K9EA000001");
    expect(validateVIN(result.vehicle.vin)).toBe(true);
  });

  it("does not fabricate specs for an unknown registration", () => {
    expect(() => lookupMockRegistration("ZZ99ZZZ")).toThrow("Sample lookup is available");
  });
});

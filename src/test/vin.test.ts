import { describe, expect, it } from "vitest";
import { normalizeVIN, validateVIN, vinMatchesMake } from "@/lib/vin";
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

  it("normalizes case, checks known WMI-to-make matches, and does not treat position 9 as a check digit", () => {
    const europeanVin = "wuazzz8ex8a800721";
    expect(normalizeVIN(europeanVin)).toBe("WUAZZZ8EX8A800721");
    expect(validateVIN(europeanVin)).toBe(true);
    expect(vinMatchesMake(europeanVin, "Audi")).toBe(true);
    expect(vinMatchesMake(europeanVin, "BMW")).toBe(false);
    expect(validateVIN("1M8GDM9A9KP042788")).toBe(true);
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

import { describe, expect, it } from "vitest";
import { claimVehicleInputSchema } from "@/services/accountApi";

describe("claim vehicle request validation", () => {
  it("accepts missing or empty references so the server can supply a development fixture reference", () => {
    expect(claimVehicleInputSchema.parse({ vrm: "LG57 VYF" })).toMatchObject({
      vrm: "LG57 VYF",
      reference: "",
    });
    expect(claimVehicleInputSchema.parse({ vrm: "BUL 200", reference: "" })).toMatchObject({
      reference: "",
    });
  });

  it("still rejects malformed non-empty logbook references", () => {
    expect(() => claimVehicleInputSchema.parse({ vrm: "LG57 VYF", reference: "123" })).toThrow();
  });
});

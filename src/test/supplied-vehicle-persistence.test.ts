import { beforeEach, describe, expect, it, vi } from "vitest";

const mockQuery = vi.hoisted(() => vi.fn());
vi.mock("../services/server/db", () => ({
  pool: { query: mockQuery },
}));

import { lookupRegistration } from "@/services/server/dvla";

describe("supplied vehicle lookup persistence", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("GOV_API_ENABLED", "false");
    for (const key of ["DVSA_API_KEY", "DVSA_CLIENT_ID", "DVSA_CLIENT_SECRET", "DVSA_SCOPE_URL", "DVSA_TOKEN_URL", "DVLA_VES_API_KEY", "MOT_HISTORY_API_KEY", "MOT_HISTORY_CLIENT_ID", "MOT_HISTORY_CLIENT_SECRET", "MOT_HISTORY_TOKEN_URL"]) {
      vi.stubEnv(key, "");
    }
    mockQuery.mockReset().mockResolvedValue({ rows: [], rowCount: 0 });
  });

  it("stores only the supplied specification record as unowned and non-sample data", async () => {
    const result = await lookupRegistration("LG57 VYF");
    const insert = mockQuery.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO vehicles"));
    expect(result.vehicle).toMatchObject({
      make: "Audi", model: "A4", colour: "Silver", fuelType: "Petrol",
      registrationDate: "2007-09-17", motExpiry: "2027-02-16",
      vin: "WUAZZZ8EX8A800721", source: "user-provided",
    });
    expect(result.notice).toContain("unverified");
    expect(insert?.[0]).toContain("VALUES($1,$2,$3,$4,'pending',false)");
    expect(JSON.parse(insert?.[1][3] as string)).toMatchObject({
      vrm: "LG57VYF", vin: "WUAZZZ8EX8A800721", source: "user-provided",
    });
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  inTransaction: vi.fn(),
  currentUser: vi.fn(),
  txQuery: vi.fn(),
}));

vi.mock("../services/server/db", () => ({
  pool: { query: mocks.poolQuery },
  inTransaction: mocks.inTransaction,
}));
vi.mock("../services/server/accounts", () => ({
  currentUser: mocks.currentUser,
  requireAdmin: vi.fn(),
  signingSecret: vi.fn(() => "test-secret"),
}));
vi.mock("../services/server/dvla", () => ({ lookupRegistration: vi.fn() }));
vi.mock("../services/server/billing", () => ({ paidTier: vi.fn() }));

import { claim } from "@/services/server/ownership";

describe("vehicle ownership lock", () => {
  beforeEach(() => {
    vi.stubEnv("NODE_ENV", "production");
    mocks.poolQuery.mockReset();
    mocks.inTransaction.mockReset();
    mocks.txQuery.mockReset();
    mocks.currentUser.mockReset().mockResolvedValue({
      id: "new-keeper", email: "keeper@example.test", email_verified: true, subscription_tier: "free",
    });
  });

  it.each(["LG57 VYF", "AB14 CDE"])("rejects a claim for %s before requesting a V5C reference", async (vrm) => {
    mocks.poolQuery.mockResolvedValueOnce({
      rows: [{ owner_user_id: "existing-keeper", vrm: vrm.replace(/\s/g, ""), vin: "WUAZZZ8EX8A800721" }],
      rowCount: 1,
    });
    await expect(claim({ vrm }))
      .rejects.toThrow("Vehicle already registered to an active keeper.");
    expect(mocks.poolQuery).toHaveBeenCalledTimes(1);
    expect(mocks.inTransaction).not.toHaveBeenCalled();
  });

  it("binds the development fixture to the authenticated first account without a V5C reference", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const vehicle = {
      id: "vehicle-lg57", vrm: "LG57VYF", vin: "WUAZZZ8EX8A800721",
      owner_user_id: null, is_sample: false, data: { vrm: "LG57VYF" },
    };
    mocks.poolQuery.mockResolvedValueOnce({ rows: [vehicle], rowCount: 1 });
    mocks.inTransaction.mockImplementation(async (action: (db: { query: typeof mocks.txQuery }) => Promise<unknown>) =>
      action({ query: mocks.txQuery }));
    mocks.txQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT * FROM vehicles")) return { rows: [vehicle], rowCount: 1 };
      if (sql.includes("SELECT count(*)::int")) return { rows: [{ count: 0 }], rowCount: 1 };
      if (sql.includes("INSERT INTO vehicle_reference_uses")) return { rows: [{ vehicle_id: vehicle.id }], rowCount: 1 };
      if (sql.startsWith("UPDATE vehicles SET")) return { rows: [{ vin: vehicle.vin }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });

    const result = await claim({ vrm: "LG57 VYF" });
    expect(result).toMatchObject({ status: "approved", is_sample: false });
    expect(mocks.txQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE vehicles SET owner_user_id=$1"),
      ["new-keeper", expect.stringMatching(/^v2\./), vehicle.vin, "PENDING_VERIFICATION"],
    );
  });
});

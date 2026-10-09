import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  inTransaction: vi.fn(),
  txQuery: vi.fn(),
  currentUser: vi.fn(),
  requireAdmin: vi.fn(),
}));

vi.mock("../services/server/db", () => ({
  pool: { query: mocks.poolQuery },
  inTransaction: mocks.inTransaction,
}));
vi.mock("../services/server/accounts", () => ({
  currentUser: mocks.currentUser,
  requireAdmin: mocks.requireAdmin,
  signingSecret: () => "verification-test-secret",
}));
vi.mock("../services/server/ownership", () => ({
  referenceDigest: (vrm: string) => `opaque-reference-hash-${vrm}`,
}));

import { reviewVehicleVerification, submitVehicleReverification } from "@/services/server/vehicle-verification";

const vin = "WUAZZZ8EX8A800721";
const vehicle = {
  id: "vehicle-1",
  vin,
  vrm: "LG57VYF",
  owner_user_id: "keeper-1",
  is_sample: false,
  is_scrapped: false,
  verification_state: "VERIFIED",
};

describe("vehicle re-verification", () => {
  beforeEach(() => {
    mocks.poolQuery.mockReset();
    mocks.txQuery.mockReset().mockResolvedValue({ rows: [], rowCount: 1 });
    mocks.inTransaction.mockReset().mockImplementation(
      async (action: (db: { query: typeof mocks.txQuery }) => Promise<unknown>) => action({ query: mocks.txQuery }),
    );
    mocks.currentUser.mockReset().mockResolvedValue({ id: "keeper-1", email_verified: true });
    mocks.requireAdmin.mockReset().mockResolvedValue({ id: "admin-1" });
  });

  it("keeps the request pending and stores only a reference digest", async () => {
    mocks.txQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT id,vin,vrm,owner_user_id")) return { rows: [vehicle], rowCount: 1 };
      if (sql.includes("SELECT id FROM vehicle_verification_requests")) return { rows: [], rowCount: 0 };
      if (sql.includes("SELECT vrm,v5c_reference_hash")) return { rows: [{ vrm: "LG57VYF", v5c_reference_hash: "old-hash" }], rowCount: 1 };
      if (sql.includes("SELECT 1 FROM vehicle_reference_uses")) return { rows: [], rowCount: 0 };
      return { rows: [], rowCount: 1 };
    });

    const result = await submitVehicleReverification({ vin, vrm: "AB14 CDE", reference: "12345678901" });
    expect(result.verification_state).toBe("RE_VERIFICATION_REQUIRED");
    const insert = mocks.txQuery.mock.calls.find(([sql]) => String(sql).includes("INSERT INTO vehicle_verification_requests"));
    expect(insert?.[1]).toEqual(expect.arrayContaining([vin, "keeper-1", "AB14CDE", "opaque-reference-hash-AB14CDE"]));
    expect(insert?.[1]).not.toContain("12345678901");
    expect(mocks.txQuery.mock.calls.some(([sql]) => String(sql).includes("UPDATE vehicles SET vrm="))).toBe(false);
  });

  it("requires reviewed evidence before a request can become verified", async () => {
    await expect(reviewVehicleVerification({
      id: "request-1",
      status: "approved",
      reviewed_evidence: false,
      reason: "No supporting document",
    })).rejects.toThrow("Review the current V5C");
    expect(mocks.inTransaction).not.toHaveBeenCalled();
  });

  it("approves only the current keeper's request after an evidence attestation", async () => {
    mocks.txQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT * FROM vehicle_verification_requests")) {
        return { rows: [{ id: "request-1", vin, user_id: "keeper-1", requested_vrm: "AB14CDE", v5c_reference_hash: "opaque", status: "pending" }], rowCount: 1 };
      }
      if (sql.includes("SELECT * FROM vehicles")) return { rows: [{ ...vehicle, verification_state: "RE_VERIFICATION_REQUIRED" }], rowCount: 1 };
      if (sql.includes("SELECT vin FROM vehicles WHERE vrm")) return { rows: [], rowCount: 0 };
      if (sql.includes("INSERT INTO vehicle_reference_uses")) return { rows: [{ vehicle_id: vehicle.id }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    });

    const result = await reviewVehicleVerification({
      id: "request-1",
      status: "approved",
      reviewed_evidence: true,
      reason: "Current V5C matched the VIN and new registration.",
    });
    expect(result.verification_state).toBe("VERIFIED");
    expect(mocks.txQuery.mock.calls.some(([sql]) => String(sql).includes("set_config('v5vault.allow_verification_update'"))).toBe(true);
    expect(mocks.txQuery.mock.calls.some(([sql]) => String(sql).includes("UPDATE vehicles SET vrm=$1"))).toBe(true);
  });
});

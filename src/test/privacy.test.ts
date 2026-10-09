import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  transactionQuery: vi.fn(),
  currentUser: vi.fn(),
  deleteClerkUser: vi.fn(),
  signStamp: vi.fn(),
}));

vi.mock("@/services/server/db", () => ({
  pool: { query: mocks.poolQuery },
  inTransaction: async (action: (db: { query: typeof mocks.transactionQuery }) => Promise<unknown>) =>
    action({ query: mocks.transactionQuery }),
}));
vi.mock("@/services/server/accounts", () => ({
  currentUser: mocks.currentUser,
  signingSecret: () => "test-signing-secret",
}));
vi.mock("@/services/server/verification", () => ({ signStamp: mocks.signStamp }));
vi.mock("@clerk/backend", () => ({
  createClerkClient: () => ({ users: { deleteUser: mocks.deleteClerkUser } }),
}));
vi.mock("@/services/server/stripe-client", () => ({ stripeClient: vi.fn() }));

import { deleteAccount } from "@/services/server/privacy";

describe("account anonymization preserves VIN history", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.currentUser.mockResolvedValue({ id: "keeper-1" });
    mocks.poolQuery.mockResolvedValue({ rows: [{ stripe_customer_id: null }] });
    mocks.deleteClerkUser.mockResolvedValue({});
    mocks.signStamp.mockReturnValue("resigned-stamp");
    mocks.transactionQuery.mockImplementation(async (sql: string) => {
      if (sql.includes("SELECT id FROM vehicles WHERE owner_user_id")) return { rows: [{ id: "vehicle-1" }] };
      if (sql.includes("SELECT id,data,is_sample,is_verified_stamp")) return {
        rows: [{
          id: "service-1",
          data: { customer_name: "Keeper Name", parts: [{ label: "Oil filter", price: 12 }], total: 50 },
          is_sample: false,
          is_verified_stamp: true,
          stamped_by_garage_id: "garage-1",
          stamp_signature: "old-stamp",
        }],
      };
      return { rows: [] };
    });
  });

  it("requires exact typed confirmation before touching account services", async () => {
    await expect(deleteAccount(new Request("https://v5vault.test/api/user/account"), "DELETE")).rejects.toThrow(
      "Type DELETE MY ACCOUNT to confirm",
    );
    expect(mocks.poolQuery).not.toHaveBeenCalled();
    expect(mocks.deleteClerkUser).not.toHaveBeenCalled();
  });

  it("keeps service and receipt rows, scrubs keeper metadata, and re-signs retained stamps", async () => {
    await deleteAccount(new Request("https://v5vault.test/api/user/account"), "DELETE MY ACCOUNT");
    const sqlCalls = mocks.transactionQuery.mock.calls as Array<[string, unknown[]?]>;
    const serviceUpdate = sqlCalls.find(([sql]) => sql.includes("UPDATE service_records SET data="));
    expect(serviceUpdate).toBeDefined();
    const savedData = JSON.parse(String(serviceUpdate?.[1]?.[0])) as Record<string, unknown>;
    expect(savedData).not.toHaveProperty("customer_name");
    expect(savedData["parts"]).toEqual([{ label: "Oil filter", price: 12 }]);
    expect(mocks.signStamp).toHaveBeenCalledWith("service-1", "garage-1", savedData, false, "test-signing-secret");
    expect(serviceUpdate?.[1]?.[3]).toBe("resigned-stamp");
    expect(sqlCalls.some(([sql]) => sql.includes("UPDATE service_attachments SET filename="))).toBe(true);
    expect(sqlCalls.some(([sql]) => /DELETE\s+FROM\s+(vehicles|service_records|service_attachments|modifications)/i.test(sql))).toBe(false);
    expect(sqlCalls.some(([sql]) => sql.includes("UPDATE vehicles SET owner_user_id=NULL"))).toBe(true);
  });
});

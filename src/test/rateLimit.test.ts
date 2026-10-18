import { beforeEach, describe, expect, it } from "vitest";
import { ANONYMOUS_LOOKUP_LIMIT_MESSAGE, clearAnonymousLookupLimits, enforceAnonymousLookupLimit, LookupRateLimitError } from "@/services/server/rateLimit";

describe("anonymous lookup rate limit", () => {
  beforeEach(() => clearAnonymousLookupLimits());

  it("allows 20 lookups per IP in an hour, then returns the branded limit error", () => {
    const request = () => new Request("https://v5vault.test/api/vehicle/lookup", { headers: { "x-real-ip": "203.0.113.12" } });
    for (let i = 0; i < 20; i += 1) enforceAnonymousLookupLimit(request(), false);
    try {
      enforceAnonymousLookupLimit(request(), false);
      throw new Error("Expected anonymous lookup to be rate-limited.");
    } catch (error) {
      expect(error).toBeInstanceOf(LookupRateLimitError);
      expect(error).toMatchObject({ status: 429, message: ANONYMOUS_LOOKUP_LIMIT_MESSAGE });
    }
  });

  it("does not count authenticated requests", () => {
    const request = new Request("https://v5vault.test/api/vehicle/lookup", { headers: { "x-real-ip": "203.0.113.13" } });
    for (let i = 0; i < 30; i += 1) enforceAnonymousLookupLimit(request, true);
    for (let i = 0; i < 20; i += 1) enforceAnonymousLookupLimit(request, false);
  });
});

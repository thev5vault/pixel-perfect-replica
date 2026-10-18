import { createHash } from "node:crypto";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_LOOKUPS = 20;
const buckets = new Map<string, { count: number; resetAt: number }>();

export const ANONYMOUS_LOOKUP_LIMIT_MESSAGE = "Rate limit reached. Try again later or create a free V5Vault account.";

export class LookupRateLimitError extends Error {
  readonly status = 429;
  constructor() {
    super(ANONYMOUS_LOOKUP_LIMIT_MESSAGE);
    this.name = "LookupRateLimitError";
  }
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return request.headers.get("x-real-ip")?.trim() || forwarded || "unknown";
}

export function enforceAnonymousLookupLimit(request: Request, authenticated: boolean): void {
  if (authenticated) return;
  const key = createHash("sha256").update(clientIp(request)).digest("hex");
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(key, bucket);
  }
  if (buckets.size > 10_000) {
    for (const [id, value] of buckets) if (value.resetAt <= now) buckets.delete(id);
  }
  if (bucket.count >= MAX_LOOKUPS) throw new LookupRateLimitError();
  bucket.count += 1;
}

export function clearAnonymousLookupLimits() {
  buckets.clear();
}

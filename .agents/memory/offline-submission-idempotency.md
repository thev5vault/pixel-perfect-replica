---
name: Offline submission idempotency
description: Keep offline retries safe without adding a dedicated database idempotency column.
---

For offline service submissions, reuse the client-generated UUID as the service record's primary key. When a retry finds that ID, return the existing record only if it belongs to the same authenticated user and vehicle VIN.

**Why:** The service table already has a stable primary key, while project schema changes must follow the supported development/publish migration flow rather than adding uncoordinated runtime DDL.

**How to apply:** Use this pattern for queued garage stamps and verify account plus VIN ownership before acknowledging a replay.

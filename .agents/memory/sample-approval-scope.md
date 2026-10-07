---
name: Sample approval scope
description: User-approved boundaries for sample ownership transfers and workshop stamps.
---

The user chose “Development-only sample verification” and asked that all sample V5C transfers and garage stamps approve instantly during testing, with a simple `status: 'approved'` flag on sample data that can later require admin review.

**Why:** The user wants to test the full ownership/stamping journey before connecting live verification.

**How to apply:** Keep instant approval development-only and explicitly sample-labelled. A syntactically valid reference, paid tier or simulated role is never live ownership/VAT evidence. Production must not grant sample approvals merely because a persisted flag is approved.

Signed document payloads must use canonical object-key ordering.

**Why:** PostgreSQL JSONB changes object-key order on round trips; insertion-order JSON signatures fail verification after persistence.

**How to apply:** Keep canonical serialization consistent in signing and verification, including nested objects and attachments.

Keep a permanent record of every consumed keeper reference; checking only the latest reference is insufficient.

**Why:** The multi-keeper browser test showed that an older, previously approved sample reference could reclaim a vehicle after its current reference changed.

**How to apply:** Consume new references in the same transaction as ownership changes, reject historical reuse by a different keeper, and allow only idempotent use by the existing keeper of their current reference.

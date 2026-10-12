---
name: Owner and workshop separation
description: Product boundary between the consumer Owner app and verified B2B Workshop Terminal.
---

Owner mode is a consumer experience: Vehicle, Vault, Passport, and Profile. Workshop mode is a separate verified B2B terminal with Express Stamp, Upcoming Jobs, and Garage Profile; it must not expose consumer tabs or consumer plan controls.

**Why:** The user repeatedly specified a strict V1 separation so public owners do not see workshop tools, and workshop staff can focus on stamping, follow-ups, and business settings.

**How to apply:** Keep navigation and profile routes role/entitlement-driven. Protect the garage, queue, and workshop profile in both route UI and server APIs; developer access is a separate explicit bypass.

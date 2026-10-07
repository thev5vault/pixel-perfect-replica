---
name: Administrator access boundaries
description: The approved distinction between real administrator access and the one-click sample preview.
---

The user chose verified administrator access plus a sample-only development shortcut, with full vehicle, garage and admin screen access in the preview.

**Why:** The shortcut is for testing all portal views without authentication or landing-page resets, not for impersonating a real account or granting unauthenticated database access.

**How to apply:** Real privileges must follow server-confirmed verified identity. Keep sample preview actions confined to fixtures and unavailable in production. Tier-view switching for an administrator must not downgrade their actual permissions, change billing, or turn their real account into a sample workshop.

Keep administrator grants derived from current verified identity rather than permanently promoting the database profile.

**Why:** A changed or unverified primary address must not retain privileges assigned during a previous login.

**How to apply:** Re-evaluate authorization for every protected read and mutation; neither a client role, a stored preview flag, nor a displayed tier is proof of administrator access.

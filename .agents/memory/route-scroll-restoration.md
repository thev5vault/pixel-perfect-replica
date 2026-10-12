---
name: Route scroll restoration
description: Why V5Vault's route changes must reset every scroll container instead of restoring prior positions.
---

**Rule:** Keep TanStack Router scroll restoration disabled while the app requires every tab navigation to start at the top. Run the app-wide reset after route commit and reset the actual scroll containers, not only `window`.

**Why:** A browser transition test showed the router's saved position could be reapplied after the app's reset, leaving the new route partway down.

**How to apply:** If router restoration is reconsidered, account for the shared scrollable `main` and verify owner and workshop tab transitions in a browser before enabling it.

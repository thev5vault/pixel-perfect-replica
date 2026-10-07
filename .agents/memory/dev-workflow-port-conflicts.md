---
name: Dev workflow port conflicts
description: Recurring stale Vite server behavior in this imported project's managed workflow.
---

A workflow reported as failed with “port already in use” can coexist with an older,
healthy Vite server. Do not repeatedly restart it without first stopping the
configured workflow and checking that its port is released.

**Why:** This environment has repeatedly reported a failed launch while an older
dev-server process still answered requests. Explicitly stopping the workflow
released the port and allowed a clean restart.

**How to apply:** Inspect current workflow output and the port listener. Stop the
existing workflow, confirm the port is free, then start it once and check its logs.

Keep browser regression validation separate from the default Run action.

**Why:** Playwright can start its own Vite server when the app is not yet ready.
Starting both workflows concurrently races for the same port and can leave the
managed app workflow failed while the test-owned server still responds.

**How to apply:** Start the app first and wait for readiness, then run browser
checks against that server. Do not add browser validation to the parallel Run group.

Registering or updating a validation command can automatically add it to the
default Run group, even when it was previously separate.

**Why:** The validation registration helper reattached the browser check while
updating its command, reintroducing the app/test-server race.

**How to apply:** After changing browser validation registration, inspect the Run
group and explicitly detach browser checks using validated workflow configuration.

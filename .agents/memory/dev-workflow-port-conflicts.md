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

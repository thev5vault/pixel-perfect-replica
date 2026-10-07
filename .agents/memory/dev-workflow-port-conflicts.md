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

The workspace `.cache` tree can grow beyond 80,000 files and exhaust Vite's
65,536 inotify-watch limit. Exclude generated cache paths from Vite's server
watcher rather than repeatedly restarting a process at the limit.

**Why:** Vite held nearly the full per-user watcher quota and failed while adding
another project-file watch; ignoring `.cache` reduced the active watcher count
substantially and restored a clean dev startup.

**How to apply:** On `ENOSPC` watcher errors, inspect the Vite process's
`/proc/<pid>/fdinfo/<fd>` watcher entries and generated directory sizes. Add
`"**/.cache/**"` to `server.watch.ignored`, then stop stale Vite processes and
restart the configured workflow once.

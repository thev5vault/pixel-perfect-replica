---
name: WebKit on Nix
description: Why the iPhone browser checks need a Nix-aware launcher and explicit graphics-library discovery.
---

Use declared, channel-resolved Nix library outputs for Playwright WebKit; do not
substitute Chromium or skip the iPhone project when native setup fails.

**Why:** Playwright's Linux host check consults the system ldconfig cache, which
does not represent all Nix libraries. The downloaded WebKit bundle's own launcher
also overwrites inherited library paths. A successful browser download therefore
does not prove that a page can open. Headless WPE still needs EGL vendor discovery
and Mesa software rendering in this environment.

**How to apply:** Preserve both bundled and declared Nix library paths in a
project-owned launcher, check actual dependency resolution, and verify page/input
interaction during setup. Keep explicit EGL discovery when changing native
packages. Treat the default download-time cache warning separately from the
readiness check's exit status; do not suppress host checks globally.

---
name: Nested Radix dialog browser tests
description: Browser-level testing behavior for stacked Radix dialogs.
---

When a Radix child dialog is open, its parent may remain mounted but be hidden from role-based accessibility queries. Use an explicit, heading-scoped DOM locator only for inspecting the parent layer, then return to role-based locators after the child closes.

**Why:** The nested upgrade flow correctly removes the parent from the accessibility tree while leaving it rendered underneath; querying both with dialog roles obscures the stacking assertion.

**How to apply:** Keep normal interaction assertions accessibility-based. For stacking checks, locate the known parent by its dialog heading and compare its rendered z-index with the active child.

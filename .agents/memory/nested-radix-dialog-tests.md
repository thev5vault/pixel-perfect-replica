---
name: Nested Radix dialog browser tests
description: Browser-level testing behavior for stacked Radix dialogs.
---

When a Radix child dialog is open, its parent may remain mounted but be hidden from role-based accessibility queries. Use an explicit, heading-scoped DOM locator only for inspecting the parent layer, then return to role-based locators after the child closes.

**Why:** The nested upgrade flow correctly removes the parent from the accessibility tree while leaving it rendered underneath; querying both with dialog roles obscures the stacking assertion.

**How to apply:** Keep normal interaction assertions accessibility-based. For stacking checks, locate the known parent by its dialog heading and compare its rendered z-index with the active child.

Safari does not reliably focus a button when it is tapped. Do not assume that
the active element identifies the opener of a controlled nested dialog unless
the opener explicitly receives focus.

**Why:** Restoring focus based on Chromium's click behavior can work on Chrome
but return to the wrong element on an iPhone.

**How to apply:** Establish the opener's focus before opening a nested dialog,
and verify the return target after both Close and Escape. When reopening a
dialog in browser tests, exercise its focus before sending Escape so that
portal/focus-layer registration has settled.

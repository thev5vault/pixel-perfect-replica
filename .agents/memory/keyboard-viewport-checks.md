---
name: Keyboard viewport checks
description: Meaningful simulation of phone keyboards in browser regression checks.
---
Keep the layout viewport unchanged when simulating an on-screen keyboard, and reduce the visual viewport independently, including a nonzero vertical offset.

**Why:** Reducing the entire browser viewport also shrinks dynamic viewport CSS units. That can hide the real keyboard failure on phones where only the visual viewport changes, even though the dialog passes a short-screen check.

**How to apply:** Verify focus and scrollable clipping boundaries during the reduced visual viewport, then restore it and confirm entered values and pointer reachability of footer actions. This simulation does not replace native-device checks for keyboard and browser chrome behavior.

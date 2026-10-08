---
name: Keyboard viewport checks
description: Meaningful simulation of phone keyboards in browser regression checks.
---
Keep the layout viewport unchanged when simulating an on-screen keyboard, and reduce the visual viewport independently, including a nonzero vertical offset.

On iPhone WebKit, focusing a control below the visible part of a modal may not scroll its nested overflow container. Browser checks should explicitly scroll the focused control into view before measuring it. Allow for fractional CSS-pixel rounding at the scroller edge, while still checking the control against the visual viewport.

**Why:** Reducing the entire browser viewport also shrinks dynamic viewport CSS units. WebKit can also leave a focused input offscreen or report fractional bounds near the scroll edge, creating false failures unless the input is explicitly brought into view.

**How to apply:** Verify focus and scrollable clipping boundaries during the reduced visual viewport, then restore it and confirm entered values and pointer reachability of footer actions. This simulation does not replace native-device checks for keyboard and browser chrome behavior.

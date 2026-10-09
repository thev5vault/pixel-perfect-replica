---
name: Mobile browser zoom
description: Accessibility decision for iOS browser viewport zoom and focus zoom.
---

Never disable pinch zoom or set `user-scalable=no`. Keep mobile form controls at 16px or larger to avoid Safari focus zoom without preventing users from enlarging the page.

**Why:** Blocking browser zoom reduces accessibility for people with low vision; 16px controls prevent focus-triggered zoom while preserving user control.

**How to apply:** Keep viewport scaling accessible on every route and fix mobile focus zoom through control typography and layout instead of clamping page scale.

---
name: Share modal testing
description: Testing the buyer-share modal's owner, preview, consent, and asynchronous state behavior.
---

For buyer-share modal interaction tests, prefer the real account and V1 providers or a browser test over mocking only the hooks. The UI combines asynchronous preview loading with owner authorization and consent state.

**Why:** A standalone mocked component test did not reliably reproduce the enabled/disabled share state, and awaiting an explicit async render act timed out.

**How to apply:** When changing sharing behavior, run the modal through its real provider setup or add coverage to the browser flow; keep simple visual assertions separate from the stateful publish path.

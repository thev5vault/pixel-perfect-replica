---
name: Mobile overflow audit signals
description: Interpreting horizontal overflow measurements on responsive cards.
---

When a card reports `scrollWidth > clientWidth`, verify whether visible text or controls are actually clipped before treating it as a mobile content overflow. Absolutely positioned blur and glow decorations can extend the scroll width while the card intentionally clips them.

**Why:** A narrow-phone sweep produced a false positive from a decorative glow even though all vehicle content stayed inside the viewport.

**How to apply:** Check document width, real horizontal scroll regions, and descendant text/control bounds together; do not remove intended decoration just to silence a raw scroll-width measurement.

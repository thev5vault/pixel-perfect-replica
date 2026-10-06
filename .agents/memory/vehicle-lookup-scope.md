---
name: Vehicle lookup scope
description: Why sample vehicle onboarding is supported alongside official DVLA and MOT adapters.
---

The user permits vehicle onboarding to fetch official data **or attach sample
vehicle data**. Keep sample lookups clearly labelled; do not treat an official API
failure as a reason to return fictional vehicle data.

**Why:** The user's polish brief explicitly allows samples for onboarding, while
the official APIs require credentials not supplied with the imported project.

**How to apply:** Samples are an intentional preview capability, not evidence of
an official lookup or ownership. Preserve that distinction when configuring live
APIs or changing onboarding.

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

A separately supplied vehicle record may be returned when no lookup credentials
exist, but it must be narrowly scoped and labelled as user-provided and unverified.
Do not use it to mask a failed configured official API request.

**Why:** The user supplied exact test-vehicle details and approved using them while
live DVLA/DVSA credentials are unavailable.

**How to apply:** Keep its provenance visible in the app and exported passports;
never label manually supplied values as official.

Browser tests should compare normalized registration numbers rather than the
formatted input value: desktop and mobile WebKit may submit the same VRM with
different spacing.

**Why:** The lookup field preserves display formatting on some browsers and
canonicalizes it on others.

**How to apply:** Strip spaces and punctuation in assertions about the API query;
keep user-facing formatting checks separate.

The DVSA OAuth client-credentials body must be form-encoded, but a token-endpoint
401 after encoding is an upstream credential/tenant rejection—not an MOT API host
failure. The current official API host is `history.mot.api.gov.uk`; the `.default`
OAuth scope uses `tapi.dvsa.gov.uk`.

**Why:** Official DVSA documentation distinguishes the API host from its OAuth
scope, and the live token endpoint returned 401 with the correctly encoded request.

**How to apply:** Keep credentials server-only, retain the documented API host,
and ask the workspace owner to refresh/check the tenant-specific credentials rather
than switching hosts or masking the failure with unverified data.

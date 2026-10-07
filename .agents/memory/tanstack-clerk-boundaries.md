---
name: TanStack and Clerk boundaries
description: Non-obvious request and typing constraints when integrating managed Clerk into TanStack Start.
---

Authenticate TanStack server functions using a fresh bodyless request containing the original URL and headers.

**Why:** The server-function framework consumes POST bodies before invoking handlers. Passing that consumed request to Clerk authentication failed only on mutations with “Response body object should not be disturbed or locked”; GET account loading still worked.

**How to apply:** Keep the original mutation under the framework's CSRF protection; the separate authentication request needs only cookie/header information, not the consumed body.

Check installed Clerk appearance typings rather than assuming older example properties are compatible with the installed SDK.

**Why:** The installed React/themes packages disagree about an optional CSS-layer property's explicit undefined under strict exact optional types; outdated appearance names also fail type checks.

**How to apply:** Omit unused optional theme properties rather than weakening TypeScript strictness or casting away appearance errors.

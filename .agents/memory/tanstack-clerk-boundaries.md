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

Treat pending signup metadata as a UI hint only; restore the existing Clerk attempt instead of recreating signup or persisting credentials.

**Why:** Safari returning from an email app can leave the UI out of sync with the provider's pending verification. A new attempt would lose continuity, while storing passwords or codes would introduce a security risk.

**How to apply:** Trust provider state for the verification step, distinguish expired attempts from temporary network failure, and never save passwords, codes or tokens in recovery storage.

Keep Clerk tokens inside Clerk; do not copy them into localStorage. A separate native WebAuthn flow must use a server-verified, hashed database session carried only by an HttpOnly SameSite cookie. Check that session before Clerk, and skip Clerk entirely when a request has no Clerk session credential.

**Why:** Browser token copies increase XSS exposure and bypass Clerk's session lifecycle. Requiring Clerk to resolve a V5Vault passkey session defeats provider independence, while calling Clerk on an anonymous request can stall mobile sign-in hydration.

**How to apply:** Use Clerk-supported force/fallback redirect props to `/dashboard`, keep `/` available while signed out, and show a retry state if Clerk is signed in but account data is unavailable. Keep native WebAuthn challenges one-time and sessions server-side; never persist bearer/session tokens in browser storage.

Use appearance style objects when Clerk must override its own component styling.

**Why:** Clerk's unlayered styles overrode Tailwind's layered `hidden` utility, leaving its footer visible and duplicating the external sign-in link despite the appearance class.

**How to apply:** Critical visibility and card styling should use the supported appearance style-object API; use scoped input CSS for Safari's minimum 16px sizing.

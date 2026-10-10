# Threat Model

## Project Overview

V5Vault ("v5vault") is a UK vehicle service-history / digital logbook application built on
TanStack Start (React + Vite) with a Nitro Node server target, deployed on Replit. It uses
PostgreSQL (via `pg`) for all application data, Clerk for primary email/password authentication
(with a self-hosted WebAuthn/passkey session as a first-party alternative), and Stripe for
subscription and one-off ("sales pack") billing. External integrations include the DVLA/DVSA
MOT history API and SendGrid/Twilio (via a provider proxy SDK) for customer reminders.

Users fall into tiers: free owners, paid DIY/Pro Modder owners, verified workshops/garages,
and a single hard-coded SuperAdmin (owner email `kieranroe23@hotmail.co.uk`). Vehicles have an
immutable VIN identity, a current keeper, V5C-reference-based ownership claims, cryptographically
signed workshop service stamps, and optional public passports.

## Assets

- **User credentials and sessions** — Clerk sessions (`__session` cookie / Bearer) and
  first-party WebAuthn passkey sessions (`v5vault_passkey_session`, hashed in DB). Compromise
  enables impersonation and account takeover.
- **Personal data (PII)** — names, emails, phone numbers, vehicle registrations, service history,
  uploaded receipts/invoices. Exported via `/api/user/export`.
- **Vehicle ownership and provenance** — keeper binding, V5C reference hashes, transfer history,
  HMAC-signed workshop stamps. Integrity is the core product value.
- **Billing state** — Stripe customer IDs, subscription tiers, sales-pack orders, tier overrides.
- **Application secrets** — `CLERK_SECRET_KEY`, `SESSION_SECRET` (stamp/reference HMAC signing),
  Stripe keys, DVLA/DVSA OAuth credentials, provider proxy keys. All server-only.

## Trust Boundaries

- **Browser to server** — TanStack server functions (`createServerFn`) and file-route API
  handlers under `src/routes/api.*`. Every sensitive handler resolves `currentUser()` server-side.
- **Server to PostgreSQL** — all queries are parameterized; no string-built SQL observed.
- **Server to Stripe / DVLA / SendGrid / Twilio** — outbound calls use env-configured endpoints
  (not user-controlled URLs). Stripe checkout fulfillment is validated against verified session
  metadata bound to `client_reference_id`/`user_id`.
- **Public vs authenticated vs admin** — public passports (`/v/$vrm`, `getPublicPassport`) and
  stamp verification (`/verify/$recordId`) are intentionally public but scoped to published,
  verified, non-sample records. Admin surfaces gated by `requireAdmin()` → `applyAdminPolicy`.
- **Internal/production boundary** — development-only sample seeding and role switching are gated
  by `NODE_ENV !== "production"`; production assumes `NODE_ENV=production`.

## Scan Anchors

- Production entry points: `src/routes/api.*.ts` (file-route handlers) and `src/services/*Api.ts`
  (`v1Api.ts`, `accountApi.ts`, `dvlaApi.ts`) exposing `createServerFn` endpoints.
- Authorization core: `src/services/server/accounts.ts` (`currentUser`, `requireAdmin`,
  `requireGarage`, `serviceAttachment`), `src/services/server/admin-policy.ts` (hard-coded owner
  email → `dev_admin`), `src/services/server/ownership.ts` (claim/transfer/reference reuse),
  `src/services/server/webauthn.ts` (passkey sessions, origin binding).
- Billing/fulfillment: `src/services/server/billing.ts`, `checkout-http.ts`,
  `sales-fulfillment.ts`, `src/lib/checkout-return.ts` (open-redirect guard).
- Clerk reverse proxy: `server/middlewares/clerkProxyMiddleware.ts` (production-only, fixed
  upstream `CLERK_FAPI`).
- Dev-only areas (ignore unless proven reachable in production): `seedDevelopmentSamples`,
  `developmentRole` non-admin branch, sample passports in `publicPassport(..., sample=true)`.

## Threat Categories

### Spoofing / Improper Authentication

Two session mechanisms coexist. Passkey sessions are checked first (token hashed with SHA-256,
validated against `webauthn_sessions`), then Clerk via `authenticateRequest` with host-derived
publishable key. WebAuthn registration binds to the authenticated `currentUser`; authentication
verifies challenge origin/RPID, credential ownership (`user_handle`), and user verification.
Guarantee: every protected endpoint MUST establish a trusted subject via `currentUser()` before
acting; passkey origin/same-site checks MUST remain enforced.

### Tampering / Elevation of Privilege

Admin rights are derived fresh each request from the verified Clerk primary email matching the
hard-coded owner address (`applyAdminPolicy`); a stale/unverified email cannot retain `dev_admin`.
Workshop stamps and V5C references are HMAC-signed with `SESSION_SECRET` over a canonical JSON
representation. Ownership transfers guard against hijack (`owner_user_id IS NULL`, reference
single-use via `vehicle_reference_uses`). Service/mod writes are scoped to owner or verified
workshop with VIN match. Guarantee: all privileged mutations MUST pass `requireAdmin`/
`requireGarage`/owner checks; client-supplied role/tier/owner fields MUST NOT be trusted.

### Information Disclosure (IDOR)

`serviceAttachment` (receipt/invoice download by raw `recordId`) enforces keeper/creator/
archive-keeper/admin authorization plus SHA-256 integrity before returning bytes. `accountState`,
`exportAccountData`, reminders, and public passports scope rows to the caller. Public passports
only expose published, verified, non-sample vehicles; paid-only fields are masked for free tiers.
Guarantee: object reads MUST be scoped to the caller's ownership/role; no endpoint may return an
object by raw ID without an ownership/authorization predicate.

### Denial of Service

Upload size limits enforced (receipts 3 MB, invoices 5 MB, scans 10 MB); zod bounds on all
string/array/number inputs; external calls use timeouts (DVLA 15 s). No obvious unauthenticated
expensive path. Rate limiting is largely delegated to Clerk/Replit infrastructure.

### SSRF / Open Redirect

Outbound URLs (DVLA/MOT token, Stripe, provider proxy, Clerk FAPI) are env-configured or fixed
constants, not user-controlled; MOT token URL is prefix-validated. Checkout return URLs are
validated by `resolveCheckoutReturnUrl` (same-origin, must start with `/`, rejects `//` and `\`).
Guarantee: outbound request targets MUST stay server-controlled; redirect targets MUST be
same-origin-validated.

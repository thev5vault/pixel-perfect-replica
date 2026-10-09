---
name: Stripe Checkout account binding
description: User-confirmed constraints for account binding, price mode, and post-checkout navigation.
---

Preserve app fields that bind Checkout sessions to V5Vault accounts and subscription entitlements when applying provider UI configuration.

**Why:** The user chose to keep these fields because removing them would break account linking, payment confirmation, and feature access after checkout.

**How to apply:** Add or update Checkout presentation parameters without deleting existing account or plan metadata. Check confirmation and entitlement flows before proposing removal.

Stripe Checkout must follow the configured Stripe account/key mode; verified SuperAdmin checkouts must not be forced into test mode.

**Why:** The user explicitly requested that SuperAdmin accounts be able to launch live Checkout sessions.

**How to apply:** Select prices for the active Stripe mode and use the configured Stripe client, while retaining verified-session, email-verification, sample-account, customer-binding, and metadata safeguards.

After checkout, return users to the same page and tab where they started, rather than defaulting to the Passport/export screen.

**Why:** The user explicitly requested that Checkout return navigation preserve the initiating page so it does not bounce users away from Plans & Access.

**How to apply:** Pass a validated same-origin path, query, and hash through Checkout; confirm payment server-side before navigating back.

---
name: Stripe connector authentication
description: Why this project's Stripe calls use connector-managed authentication instead of exported API credentials.
---
Use the attached Stripe connector's managed authentication for Stripe operations. Do not extract a key or replace the connection with a manually configured key merely to follow a generic Stripe example.

**Why:** The user connected Stripe through Replit's connector; its SDK handles authentication and renewal. Generic library examples that assume direct keys are not the integration contract for this project.

**How to apply:** Preserve authenticated connector transport when adding Stripe SDK or synchronization functionality. Keep sandbox configuration separate from explicit live activation.

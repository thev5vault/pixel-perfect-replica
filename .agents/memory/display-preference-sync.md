---
name: Display preference sync
description: How V5Vault resolves local and account-level display mode preferences.
---

When device storage and the account's display preference differ at sign-in, keep the saved device choice and sync it to the account. If the device has no saved choice, initialize from the account.

**Why:** The display mode must be available before sign-in and should follow a user account across sessions, while preserving a choice made locally before authentication.

**How to apply:** Preserve this precedence when changing display-mode hydration or adding another preference that works offline and syncs after sign-in.

---
name: Account profile refresh races
description: Preserve account edits when a background refresh returns stale profile fields.
---

After a profile save succeeds, keep the submitted profile fields in shared account state both immediately and after the follow-up refresh. A refresh can race or return an older snapshot and otherwise revert the visible header/settings values.

**Why:** The UI test reproduced an older account snapshot overwriting a just-saved display name when both React updates were batched.

**How to apply:** When profile-saving behavior triggers a refresh or polling update, merge the saved fields back into the current user state rather than replacing them with potentially stale values.

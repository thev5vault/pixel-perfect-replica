---
name: VIN history after account deletion
description: Required retention and anonymization behavior when a V5Vault user deletes their account.
---

Account deletion must remove the person's account identity and billing linkage but preserve VIN-anchored vehicles, service records, modifications, receipt/invoice bytes, and workshop facts. Anonymize personal attribution and metadata rather than deleting the vehicle's history.

**Why:** The user requires vehicle history to follow the VIN across keepers, while personal account data must be removable.

**How to apply:** For privacy export/deletion or ownership changes, scrub personal identifiers and remap required historical foreign keys to an anonymous identity. Never cascade-delete vehicle, service, modification, or attachment history.

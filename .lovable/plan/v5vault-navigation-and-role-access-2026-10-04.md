# V5Vault navigation and role access

## What will change
- Keep the four-tab navigation fixed to the viewport bottom at `z-50`, including safe-area spacing.
- Give the main content a consistent `pb-20` buffer so the final content remains visible above the navigation.
- Keep the header role switcher and label its three preview roles as Everyday Driver, Pro Modder, and Garage.
- Gate The Vault by role: Pro Modder sees the complete existing read/write experience; Everyday Driver and Garage see a polished locked state over a blurred preview with the requested £1.99/month upgrade message.
- Gate Garage Portal by role: Garage sees the complete existing fast-log and Verified Workshop workflow; Everyday Driver and Pro Modder see the requested specialist-access lock screen with the £9.99/month verification message.

## Technical details
- Preserve the existing role values and saved demo state, while mapping them to the new visible role labels.
- Extract or wrap the existing route content so locked previews cannot invoke write actions.
- Use the existing design tokens, controls, and mobile layout conventions; no checkout or live subscription billing will be added.
- Verify all three roles across The Vault and Garage Portal, plus fixed navigation and content clearance at the current mobile size.

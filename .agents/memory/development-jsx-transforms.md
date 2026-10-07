---
name: Development JSX transforms
description: A development-only parser failure that production compilation did not detect.
---
Use conventional JSX self-closing syntax `/>`, never `/ >`. Confirm newly added routes load in the actual development preview, not just with TypeScript and a production build.

**Why:** The imported development JSX transform mishandled spaced self-closing tags. TypeScript and the production build passed, but importing the buyer route caused both home and the guest route to return HTTP 500. Normalizing those tags restored both routes.

**How to apply:** For unexplained dev-only JSX errors, check transformed module requests to identify the offending module before changing unrelated application logic.

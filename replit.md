# Running the app on Replit

- Use Node.js 22 for this TanStack Start/Vite project.
- Install dependencies with `npm install`.
- Start the development server with `npm run dev`.
- The Replit web preview uses port 5000.
- Run `npm test` for the test suite or `npm run build` for a production build.

## Accounts and development verification

- Clerk manages email/password credentials. App profiles, ownership links, records and notifications use PostgreSQL; no client-side role grants authorize workshop stamps.
- In production, only authenticated SuperAdmins may switch tier views; changing their view must not change real permissions or billing. Ordinary development role switching remains development-only.
- The database schema is in `db/schema.sql`. Apply schema changes to development, and use Replit's publishing migration process for production; do not execute startup DDL.
- The Node Nitro target and explicitly registered canonical Clerk proxy are required for the account backend.

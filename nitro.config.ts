import { defineConfig } from "nitro/config";

export default defineConfig({
  // Vite's Nitro integration does not scan server/routes by default.
  // Register the canonical Clerk proxy explicitly alongside the Start entry.
  routes: {
    "/api/__clerk/**": "./server/routes/api/__clerk/[...path].ts",
  },
});

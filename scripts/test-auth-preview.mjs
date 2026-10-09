import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const target =
  process.env["PLAYWRIGHT_BASE_URL"] ??
  (process.env["REPLIT_DEV_DOMAIN"] ? `https://${process.env["REPLIT_DEV_DOMAIN"]}` : undefined);

if (!target) {
  throw new Error("Set REPLIT_DEV_DOMAIN or PLAYWRIGHT_BASE_URL to the HTTPS preview host.");
}

const previewUrl = new URL(target.includes("://") ? target : `https://${target}`);
if (previewUrl.protocol !== "https:") {
  throw new Error("The Safari auth preview checks require an HTTPS URL.");
}

const result = spawnSync(
  process.execPath,
  [
    resolve("node_modules/@playwright/test/cli.js"),
    "test",
    "e2e/auth-preview.spec.ts",
    "--project=iphone-webkit",
    ...process.argv.slice(2),
  ],
  {
    stdio: "inherit",
    env: { ...process.env, PLAYWRIGHT_BASE_URL: previewUrl.origin },
  },
);

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;

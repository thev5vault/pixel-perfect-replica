import { execFileSync } from "node:child_process";
import { webkit } from "playwright";
import { webkitLaunchOptions } from "./webkit-runtime.mjs";

// Use the exact browser revision belonging to the npm lockfile.
execFileSync(process.execPath, ["node_modules/@playwright/test/cli.js", "install", "webkit"], {
  stdio: "inherit",
});
const browser = await webkit.launch(webkitLaunchOptions());
try {
  const page = await browser.newPage();
  await page.setContent("<input aria-label='Browser readiness' />");
  await page.getByLabel("Browser readiness").fill("ready");
  if (await page.getByLabel("Browser readiness").inputValue() !== "ready") {
    throw new Error("WebKit readiness check failed");
  }
  console.log(`WebKit ${browser.version()} launched and passed the readiness check.`);
} finally {
  await browser.close();
}

import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

const localChromium = "/repl/tools/bin/chromium";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.spec.ts",
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5000",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        launchOptions: {
          ...(existsSync(localChromium) ? { executablePath: localChromium } : {}),
          args: ["--no-sandbox", "--disable-dev-shm-usage"],
        },
      },
    },
    {
      name: "iphone-webkit",
      use: { ...devices["iPhone 13"], browserName: "webkit" },
    },
  ],
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 5000 --strictPort",
    url: "http://127.0.0.1:5000",
    reuseExistingServer: !process.env.CI,
    timeout: 90_000,
  },
});

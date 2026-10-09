import { expect, test } from "@playwright/test";

test.skip(
  !process.env["PLAYWRIGHT_BASE_URL"],
  "Run with npm run test:browser:auth-preview to check the HTTPS preview host.",
);

test("HTTPS preview sign-in renders the Clerk sign-in form", async ({ page }) => {
  await page.goto("/sign-in", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: "Sign in to V5Vault" })).toBeVisible({
    timeout: 45_000,
  });
  await expect(page.getByRole("textbox").first()).toBeVisible();
});

test("dashboard waits for Clerk hydration before routing a signed-out visitor", async ({
  page,
}) => {
  let unblockClerkRequest!: () => void;
  let signalClerkRequest!: () => void;
  let clerkRequestHeld = false;
  const clerkRequestGate = new Promise<void>((resolve) => {
    unblockClerkRequest = resolve;
  });
  const clerkRequestStarted = new Promise<void>((resolve) => {
    signalClerkRequest = resolve;
  });

  await page.route(
    (url) => /\/v1\/client(?:\/|$)/.test(url.pathname),
    async (route) => {
      clerkRequestHeld = true;
      signalClerkRequest();
      await clerkRequestGate;
      await route.continue();
    },
  );

  try {
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await expect.poll(() => clerkRequestHeld, { timeout: 30_000 }).toBe(true);
    await clerkRequestStarted;
    await expect(page).toHaveURL(/\/dashboard\/?$/);
    await expect(page.getByRole("status")).toHaveText("Restoring your session…");
  } finally {
    unblockClerkRequest();
  }

  await expect(page).toHaveURL(/\/sign-in\/?$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Sign in to V5Vault" })).toBeVisible({
    timeout: 45_000,
  });
});

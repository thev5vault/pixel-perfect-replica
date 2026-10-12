import { expect, test } from "@playwright/test";

test("driver auth route renders inside the V5Vault card", async ({ page }) => {
  await page.goto("/auth/driver");
  await expect(page.getByRole("heading", { name: "Sign in to Driver Glovebox" })).toBeVisible({
    timeout: 45_000,
  });
  await expect(page).toHaveScreenshot("driver-auth.png", { animations: "disabled" });
});

test("workshop auth route presents the workshop trial", async ({ page }) => {
  await page.goto("/auth/workshop?mode=signup");
  await expect(
    page.getByRole("heading", {
      name: "Verified Workshop Terminal Portal — 30-Day Free Trial (£9.99/mo)",
    }),
  ).toBeVisible({ timeout: 45_000 });
  await expect(page).toHaveScreenshot("workshop-auth.png", { animations: "disabled" });
});

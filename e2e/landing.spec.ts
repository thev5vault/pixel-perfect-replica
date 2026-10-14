import { expect, test } from "@playwright/test";

test("landing page CTAs and mobile visual baseline", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("button", { name: /Create Account/ })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page).toHaveScreenshot("landing-page.png", {
    animations: "disabled",
    fullPage: true,
  });
});

test("persona choices navigate directly to their auth routes", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Choose Driver Passport/ }).click();
  await expect(page).toHaveURL(/\/auth\/driver$/);
  await page.goto("/");
  await page.getByRole("button", { name: /Choose Workshop Terminal/ }).click();
  await expect(page).toHaveURL(/\/auth\/workshop$/);
});

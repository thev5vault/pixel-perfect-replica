import { expect, test } from "@playwright/test";

test("sample SuperAdmin console exposes workshop and account administration", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Direct GodMode Bypass/ }).click();
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Admin Console" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Workshop applications/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Tier Overrides/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Registered users/ })).toBeVisible();
  await expect(page).toHaveScreenshot("sample-admin-console.png", {
    animations: "disabled",
    maxDiffPixels: 25,
    mask: [page.getByText(/Development sample metrics · not live financial data · snapshot/)],
  });
});

import { expect, test } from "@playwright/test";

test("anonymous visitor can view the DVSA-only LG57 passport", async ({ page }) => {
  await page.setViewportSize({ width: 402, height: 874 });
  await page.goto("/passport/LG57VYF");

  await expect(page.getByRole("heading", { name: /Audi A4/i })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/✓ DVSA Verified/)).toBeVisible();
  await expect(page.getByText("DVSA MOT Test History")).toBeVisible();
  await expect(page.getByText("Verified live via GOV.UK DVSA MOT API")).toBeVisible();
  await expect(page.getByText("MOT mileage trend")).toBeVisible();
  await expect(page.getByText("Sign in to V5Vault")).toHaveCount(0);
  await expect(page.getByText("This snapshot is private to the owner")).toHaveCount(0);
});

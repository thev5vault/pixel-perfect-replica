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

test("auth mode links preserve the selected driver or workshop persona", async ({ page }) => {
  await page.goto("/auth/workshop?mode=signup");
  await expect(page.getByRole("heading", {
    name: "Verified Workshop Terminal Portal — 30-Day Free Trial (£9.99/mo)",
  })).toBeVisible({ timeout: 45_000 });

  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/auth\/workshop$/);
  await expect(page.getByRole("heading", {
    name: "Sign in to Verified Workshop Terminal Portal",
  })).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText("Access your workshop terminal & service logging dashboard.")).toBeVisible();

  await page.getByRole("link", { name: "Create account", exact: true }).click();
  await expect(page).toHaveURL(/\/auth\/workshop\?mode=signup$/);
  await expect(page.getByRole("heading", {
    name: "Verified Workshop Terminal Portal — 30-Day Free Trial (£9.99/mo)",
  })).toBeVisible({ timeout: 45_000 });

  await page.goto("/auth/driver?mode=signup");
  await expect(page.getByRole("heading", { name: "Create Driver Account" })).toBeVisible({
    timeout: 45_000,
  });
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/auth\/driver$/);
  await expect(page.getByRole("heading", { name: "Sign in to Driver Glovebox" })).toBeVisible({
    timeout: 45_000,
  });
});

test("mobile auth actions and footer links fit within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/auth/driver");
  await expect(page.getByRole("button", { name: /Sign in with Face ID/ })).toBeInViewport();
  await expect(page.getByRole("link", { name: "Create account", exact: true })).toBeInViewport();

  await page.goto("/auth/workshop?mode=signup");
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeInViewport();
  await expect(page.getByRole("link", { name: "Sign in", exact: true })).toBeInViewport();
});

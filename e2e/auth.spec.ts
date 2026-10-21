import { expect, test } from "@playwright/test";

test("driver auth route renders inside the V5Vault card", async ({ page }) => {
  await page.goto("/auth/driver");
  await expect(page.getByRole("heading", { name: "Sign in to Driver Glovebox" })).toBeVisible({
    timeout: 45_000,
  });
  await expect(page.getByText("Access your vehicle records and history.")).toBeVisible();
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

test("role switcher preserves the active sign-in or sign-up mode", async ({ page }) => {
  await page.goto("/auth/driver");
  const roleSwitch = page.getByRole("navigation", { name: "Choose account type" });
  await expect(roleSwitch.getByRole("link", { name: "Vehicle Owner" })).toHaveAttribute("aria-current", "page");
  await roleSwitch.getByRole("link", { name: "Verified Workshop" }).click();
  await expect(page).toHaveURL(/\/auth\/workshop$/);
  await expect(page.getByRole("heading", { name: "Sign in to Verified Workshop Terminal Portal" })).toBeVisible();

  await page.goto("/auth/workshop?mode=signup");
  await page.getByRole("navigation", { name: "Choose account type" }).getByRole("link", { name: "Vehicle Owner" }).click();
  await expect(page).toHaveURL(/\/auth\/driver\?mode=signup$/);
  await expect(page.getByRole("heading", { name: "Create Driver Account" })).toBeVisible();
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

test("private routes show role-specific sign-in prompts and public passports remain guest-accessible", async ({ page }) => {
  await page.goto("/vehicle");
  await expect(page.getByRole("heading", { name: "Sign in to Vehicle Owner (Driver Glovebox)" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue to sign in" })).toHaveAttribute("href", "/auth/driver");

  await page.goto("/garage");
  await expect(page.getByRole("heading", { name: "Sign in to Verified Workshop Terminal Portal" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue to sign in" })).toHaveAttribute("href", "/auth/workshop");

  await page.goto("/passport/AB12CDE");
  await expect(page).toHaveURL(/\/v\/AB12CDE(?:\?sample=false)?$/);
  await expect(page.getByText("Buyer passport · public vehicle record")).toBeVisible();
  await expect(page.getByText("Restoring session…")).toHaveCount(0);

  await page.goto("/passport/AB12CDE/full");
  await expect(page).toHaveURL(/\/v\/AB12CDE(?:\?sample=false)?$/);
  await expect(page.getByText("Buyer passport · public vehicle record")).toBeVisible();
});

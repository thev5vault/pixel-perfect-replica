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
  await page.getByRole("button", { name: "Workshop Terminal", exact: false }).first().click();
  await expect(page).toHaveURL(/\/auth\/workshop$/);
  await expect(page.getByRole("dialog", { name: "Choose your V5Vault role" })).toHaveCount(0);

  await page.goto("/");
  await page.getByRole("button", { name: /Choose Vehicle Owner \(Driver Glovebox\)/ }).click();
  await expect(page).toHaveURL(/\/auth\/driver$/);
  await page.goto("/");
  await page.getByRole("button", { name: /Choose Workshop Terminal/ }).click();
  await expect(page).toHaveURL(/\/auth\/workshop$/);
});

test("only the generic header actions open the role chooser", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const signInDialog = page.getByRole("dialog", { name: "Sign in to V5Vault" });
  await expect(signInDialog).toBeVisible();
  await expect(signInDialog.getByText("Select your account type to access your dashboard.")).toBeVisible();
  await expect(signInDialog.getByRole("button", { name: /Vehicle Owner \(Driver Glovebox\)/ })).toBeVisible();
  await signInDialog.getByRole("button", { name: /Vehicle Owner \(Driver Glovebox\)/ }).click();
  await expect(page).toHaveURL(/\/auth\/driver$/);

  await page.goto("/");
  await page.getByRole("button", { name: /Create Account/ }).click();
  const signUpDialog = page.getByRole("dialog", { name: "Choose your V5Vault role" });
  await expect(signUpDialog).toBeVisible();
  await signUpDialog.getByRole("button", { name: /Vehicle Owner \(Driver Glovebox\)/ }).click();
  await expect(page).toHaveURL(/\/auth\/driver\?mode=signup$/);

  await page.goto("/");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const workshopSignInDialog = page.getByRole("dialog", { name: "Sign in to V5Vault" });
  await workshopSignInDialog.getByRole("button", { name: /Verified Workshop/ }).click();
  await expect(page).toHaveURL(/\/auth\/workshop$/);
});

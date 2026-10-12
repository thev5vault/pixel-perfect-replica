import { expect, test } from "@playwright/test";

async function startSample(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Direct GodMode Bypass/ }).click();
  await page.goto("/vehicle");
}

test("driver glovebox tabs reset scroll and show responsive screens", async ({ page }) => {
  await startSample(page);
  const main = page.locator("main").first();
  for (const tab of ["Vault", "Passport", "Vehicle"]) {
    await main.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    await page.getByRole("link", { name: tab, exact: true }).click();
    await expect.poll(() => main.evaluate((element) => element.scrollTop)).toBe(0);
    await expect(main).toBeVisible();
    if (tab === "Vehicle") {
      await expect(page).toHaveScreenshot("driver-vehicle.png", { animations: "disabled" });
    }
  }
});

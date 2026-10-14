import { expect, test } from "@playwright/test";

test("workshop Express Stamp, detail drawer, and tab navigation", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Direct GodMode Bypass/ }).click();
  await page.goto("/garage");
  await page.route("**/api/garage/lookup", (route) =>
    route.fulfill({
      json: {
        vehicle: {
          vrm: "AB14CDE",
          vin: "WUAZZZ8EX8A800721",
          make: "Audi",
          model: "A4",
          year: 2007,
          odometer: 87420,
          motExpiry: "2027-02-16",
          source: "sample",
        },
      },
    }),
  );
  await expect(page.getByText("Express Core", { exact: true })).toBeVisible();
  await page.getByLabel("Vehicle registration").fill("AB14 CDE");
  await page.getByRole("button", { name: "Fetch specs" }).click();
  await expect(page.getByText(/VIN Bound:/)).toBeVisible();
  await page.evaluate(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    document.querySelector("main")?.scrollTo({ top: 0, left: 0, behavior: "instant" });
  });
  await expect(page).toHaveScreenshot("workshop-express.png", {
    animations: "disabled",
    maxDiffPixels: 3000,
  });

  const chips = page.locator("main").getByRole("button", { name: "+ More components" });
  await expect(chips).toBeVisible();
  await chips.click();
  await expect(page.getByRole("button", { name: "- Fewer components" })).toBeVisible();
  await page.getByRole("button", { name: /Add Detailed Breakdown & Receipt/ }).click();
  await expect(page.getByLabel("Work performed / notes")).toBeVisible();

  const main = page.locator("main").first();
  await main.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await page.getByRole("link", { name: "Upcoming Jobs" }).click();
  await expect.poll(() => main.evaluate((element) => element.scrollTop)).toBe(0);
  await expect(page.getByPlaceholder(/registration or VIN/i)).toBeVisible();
  await expect(page).toHaveScreenshot("workshop-upcoming-jobs.png", {
    animations: "disabled",
    maxDiffPixels: 300,
  });
  await page.getByRole("link", { name: "Garage Profile" }).click();
  await expect.poll(() => main.evaluate((element) => element.scrollTop)).toBe(0);
  await expect(page.getByRole("heading", { name: "Garage branding" })).toBeVisible();
  await expect(page).toHaveScreenshot("workshop-profile.png", {
    animations: "disabled",
    maxDiffPixels: 300,
  });
});

import { expect, test } from "@playwright/test";

test("vehicle lookup fills verified MOT mileage and VIN in Express Stamp", async ({ page }) => {
  await page.route("**/api/vehicle/lookup**", async (route) => {
    const url = new URL(route.request().url());
    expect(url.searchParams.get("vrm")?.replace(/\s/g, "")).toBe("AB14CDE");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        vehicle: {
          vrm: "AB14CDE",
          make: "Audi",
          model: "A4",
          colour: "Silver",
          fuelType: "Petrol",
          vin: "WAUZZZ8K9EA000001",
          odometer: 86420,
          odometerAvailable: true,
          motExpiry: "2027-02-16",
          motHistory: [{ date: "2026-02-16", mileage: 86420, result: "Pass", advisories: ["Sample advisory"] }],
          source: "official",
        },
        notice: "Vehicle and MOT history loaded from official APIs.",
      }),
    });
  });

  await page.goto("/");
  await page.getByRole("button", { name: /Direct GodMode Bypass/ }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/garage");
  await expect(page).toHaveURL(/\/garage$/);
  await page.getByRole("textbox", { name: /Vehicle registration/ }).fill("AB14 CDE");
  await page.getByRole("button", { name: "Fetch specs" }).click();
  await expect(page.getByText(/VIN Bound: WAUZZZ8K9EA000001/)).toBeVisible();
  await expect(page.getByLabel("Odometer (miles)", { exact: true })).toHaveValue("86420");
  await expect(page.getByText(/Vehicle and MOT history loaded from official APIs/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "MOT history" })).toBeVisible();
  await expect(page.getByText("Sample advisory", { exact: true })).toBeVisible();
});

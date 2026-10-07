import { expect, test, type Locator, type Page } from "@playwright/test";

type ViewportCase = {
  name: string;
  width: number;
  height: number;
  mobile: boolean;
};

const viewports: ViewportCase[] = [
  { name: "390px phone", width: 390, height: 844, mobile: true },
  { name: "1024px wide", width: 1024, height: 900, mobile: false },
];

type Bounds = { left: number; right: number; top: number; bottom: number };

async function bounds(element: Locator): Promise<Bounds> {
  return element.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
  });
}

function expectInside(inner: Bounds, outer: Bounds, focusInset = 0) {
  expect(inner.left - focusInset).toBeGreaterThanOrEqual(outer.left);
  expect(inner.right + focusInset).toBeLessThanOrEqual(outer.right);
  expect(inner.top - focusInset).toBeGreaterThanOrEqual(outer.top);
  expect(inner.bottom + focusInset).toBeLessThanOrEqual(outer.bottom);
}

function fieldControl(root: Locator, label: string) {
  const field = root.locator("label").filter({ hasText: label }).first();
  return {
    field,
    control: field.locator("input, select, textarea, button.field").first(),
  };
}

async function focusAndCheck(dialog: Locator, label: string, mobile: boolean): Promise<Bounds> {
  const { control } = fieldControl(dialog, label);
  await expect(control).toBeVisible();
  await control.focus();
  await expect(control).toBeFocused();

  const state = await control.evaluate((element) => {
    const labelElement = element.closest("label");
    const rect = element.getBoundingClientRect();
    const fieldRect = labelElement?.getBoundingClientRect();
    return {
      tagName: element.tagName,
      hasFieldClass: element.classList.contains("field"),
      fontSize: getComputedStyle(element).fontSize,
      borderStyle: getComputedStyle(element).borderTopStyle,
      borderWidth: Number.parseFloat(getComputedStyle(element).borderTopWidth),
      controlBoxShadow: getComputedStyle(element).boxShadow,
      fieldBoxShadow: labelElement ? getComputedStyle(labelElement).boxShadow : "none",
      rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom },
      fieldRect: fieldRect
        ? {
            left: fieldRect.left,
            right: fieldRect.right,
            top: fieldRect.top,
            bottom: fieldRect.bottom,
          }
        : null,
    };
  });
  const dialogBounds = await bounds(dialog);
  expectInside(state.rect, dialogBounds, 3);
  if (state.fieldRect) expectInside(state.fieldRect, dialogBounds, 3);

  if (mobile && ["INPUT", "SELECT", "TEXTAREA"].includes(state.tagName)) {
    expect(state.fontSize, `${label} should avoid mobile input zoom`).toBe("16px");
  }
  expect(state.fieldBoxShadow, `${label} focus indicator should be visible`).not.toBe("none");
  expect(state.borderStyle, `${label} border should remain visible`).not.toBe("none");
  expect(state.borderWidth, `${label} border should remain visible`).toBeGreaterThanOrEqual(1);
  if (state.hasFieldClass && state.tagName !== "BUTTON") {
    expect(state.controlBoxShadow, `${label} control focus indicator should be visible`).not.toBe(
      "none",
    );
  }
  return state.rect;
}

async function checkPair(
  dialog: Locator,
  firstLabel: string,
  secondLabel: string,
  mobile: boolean,
) {
  const first = await focusAndCheck(dialog, firstLabel, mobile);
  const second = await focusAndCheck(dialog, secondLabel, mobile);
  const overlapsHorizontally = first.left < second.right && second.left < first.right;
  const overlapsVertically = first.top < second.bottom && second.top < first.bottom;
  expect(
    overlapsHorizontally && overlapsVertically,
    `${firstLabel} and ${secondLabel} must not overlap`,
  ).toBe(false);
}

async function startSamplePreview(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Direct GodMode Bypass/ }).click();
  await page.goto("/vehicle");
  await expect(page.getByRole("heading", { name: "Service History" })).toBeVisible();
}

async function selectTier(page: Page, tier: RegExp) {
  await page.getByRole("button", { name: "Open profile menu" }).click();
  await page.getByRole("menuitem", { name: tier }).click();
  await expect(page.getByRole("button", { name: "Open profile menu" })).toBeVisible();
}

for (const viewport of viewports) {
  test(`mobile forms and nested upgrade fit at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await startSamplePreview(page);

    // Pro DIY exposes all three real two-column field groups in Snap Receipt.
    await selectTier(page, /Pro DIY/);
    await page.getByRole("button", { name: "Snap Receipt" }).click();
    const proReceipt = page.getByRole("dialog", { name: "Snap Receipt" });
    await expect(proReceipt).toBeVisible();
    expectInside(await bounds(proReceipt), {
      left: 0,
      top: 0,
      right: viewport.width,
      bottom: viewport.height,
    });
    await checkPair(proReceipt, "Date", "Mileage", viewport.mobile);
    await checkPair(proReceipt, "Category", "Garage Name", viewport.mobile);
    await checkPair(proReceipt, "Parts (£)", "Labour (£)", viewport.mobile);

    await proReceipt.getByRole("button", { name: "Close" }).click();
    await expect(proReceipt).toBeHidden();

    // Owner view opens the same receipt form via its basic-entry path, where
    // the locked cost breakdown opens the nested Pro upgrade.
    await selectTier(page, /Basic Driver \(Free\)/);
    await page.getByRole("button", { name: "Add a basic DIY service entry" }).click();
    const receipt = page.getByRole("dialog", { name: "Snap Receipt" });
    await expect(receipt).toBeVisible();
    await receipt.getByRole("button", { name: /Parts vs labour cost/ }).click();

    const upgrade = page.getByRole("dialog", { name: /Upgrade to Pro DIY/ });
    await expect(upgrade).toBeVisible();
    const openBackdrops = page.locator('[data-state="open"][class*="fixed"][class*="inset-0"]');
    await expect(openBackdrops).toHaveCount(2);
    const backdropZIndexes = await openBackdrops.evaluateAll((elements) =>
      elements.map((element) => Number.parseInt(getComputedStyle(element).zIndex, 10)),
    );
    expect(Math.max(...backdropZIndexes)).toBeGreaterThan(Math.min(...backdropZIndexes));

    const parentDialog = page.locator('[role="dialog"]').filter({ hasText: "Snap Receipt" });
    const parentZIndex = await parentDialog.evaluate((element) =>
      Number.parseInt(getComputedStyle(element).zIndex, 10),
    );
    const upgradeZIndex = await upgrade.evaluate((element) =>
      Number.parseInt(getComputedStyle(element).zIndex, 10),
    );
    expect(upgradeZIndex).toBeGreaterThan(parentZIndex);
    expectInside(await bounds(upgrade), {
      left: 0,
      top: 0,
      right: viewport.width,
      bottom: viewport.height,
    });

    await upgrade.getByRole("button", { name: "Close" }).click();
    await expect(upgrade).toBeHidden();
    await expect(receipt).toBeVisible();
    await receipt.getByRole("button", { name: "Close" }).click();
    await expect(receipt).toBeHidden();

    // The signed-in sample account enables the real V5C reference field.
    await page.getByRole("button", { name: /Audi A4/ }).click();
    await page.getByRole("menuitem", { name: /Connect New Vehicle/ }).click();
    const vehicleDialog = page.getByRole("dialog", { name: "Connect New Vehicle" });
    await expect(vehicleDialog).toBeVisible();
    expectInside(await bounds(vehicleDialog), {
      left: 0,
      top: 0,
      right: viewport.width,
      bottom: viewport.height,
    });
    await focusAndCheck(vehicleDialog, "Vehicle registration mark", viewport.mobile);
    await focusAndCheck(vehicleDialog, "11-digit V5C logbook reference", viewport.mobile);
    await vehicleDialog.getByRole("button", { name: "Close" }).click();
    await expect(vehicleDialog).toBeHidden();
  });
}

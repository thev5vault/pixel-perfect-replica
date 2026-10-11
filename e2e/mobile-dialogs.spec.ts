import { expect, test, type Locator, type Page } from "@playwright/test";
import QRCode from "qrcode";

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

async function visibleViewport(page: Page): Promise<Bounds> {
  return page.evaluate(() => {
    const viewport = window.visualViewport;
    const left = viewport?.offsetLeft ?? 0;
    const top = viewport?.offsetTop ?? 0;
    return {
      left,
      top,
      right: left + (viewport?.width ?? window.innerWidth),
      bottom: top + (viewport?.height ?? window.innerHeight),
    };
  });
}
function fieldControl(root: Locator, label: string) {
  return {
    control: root.getByLabel(label, { exact: true }),
  };
}

async function focusAndCheck(dialog: Locator, label: string, mobile: boolean): Promise<Bounds> {
  const { control } = fieldControl(dialog, label);
  await expect(control).toBeVisible();
  await control.focus();
  await control.evaluate((element) =>
    element.scrollIntoView({ block: "center", inline: "nearest" }),
  );
  await expect(control).toBeFocused();

  const state = await control.evaluate((element) => {
    const labelElement = element.closest("[data-modal-field], label");
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
  expectInside(state.rect, await visibleViewport(control.page()), 3);

  if (mobile && ["INPUT", "SELECT", "TEXTAREA"].includes(state.tagName)) {
    expect(state.fontSize, `${label} should avoid mobile input zoom`).toBe("16px");
  }
  expect(state.controlBoxShadow, `${label} focus indicator should be visible`).not.toBe("none");
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
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("link", { name: "Vehicle", exact: true }).click();
  await expect(page).toHaveURL(/\/vehicle$/);
  await expect(page.getByRole("heading", { name: "Service History" })).toBeVisible();
}

async function selectTier(page: Page, tier: RegExp) {
  await page.getByRole("button", { name: "Open profile menu" }).click();
  await page.getByRole("menuitem", { name: tier }).click();
  await expect(page.getByRole("button", { name: "Open profile menu" })).toBeVisible();
}

async function checkPageHasNoHorizontalOverflow(page: Page, label: string) {
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));
  expect(widths.document, `${label} document should not scroll horizontally`).toBeLessThanOrEqual(
    widths.viewport + 1,
  );
  expect(widths.body, `${label} page content should not scroll horizontally`).toBeLessThanOrEqual(
    widths.viewport + 1,
  );
}

async function increasePageTextScale(page: Page) {
  await page.evaluate(() => {
    const root = document.documentElement;
    const currentSize = Number.parseFloat(getComputedStyle(root).fontSize);
    root.style.fontSize = `${currentSize * 1.5}px`;
  });
  await expect
    .poll(() =>
      page.evaluate(() => Number.parseFloat(getComputedStyle(document.documentElement).fontSize)),
    )
    .toBeGreaterThan(20);
}

async function checkInsideParent(element: Locator, label: string) {
  const bounds = await element.evaluate((node, elementLabel) => {
    const parent = node.parentElement;
    if (!parent) throw new Error(`${elementLabel} is missing its layout parent.`);
    const childRect = node.getBoundingClientRect();
    const parentRect = parent.getBoundingClientRect();
    return {
      child: {
        left: childRect.left,
        right: childRect.right,
        top: childRect.top,
        bottom: childRect.bottom,
      },
      parent: {
        left: parentRect.left,
        right: parentRect.right,
        top: parentRect.top,
        bottom: parentRect.bottom,
      },
      childScrollWidth: (node as HTMLElement).scrollWidth,
      childClientWidth: (node as HTMLElement).clientWidth,
    };
  }, label);
  expect(
    bounds.child.left,
    `${label} should stay inside its parent on the left`,
  ).toBeGreaterThanOrEqual(bounds.parent.left - 1);
  expect(
    bounds.child.right,
    `${label} should stay inside its parent on the right`,
  ).toBeLessThanOrEqual(bounds.parent.right + 1);
  expect(
    bounds.childScrollWidth,
    `${label} should not clip or scroll its content`,
  ).toBeLessThanOrEqual(bounds.childClientWidth + 1);
}

async function addLongPartFixture(page: Page, partReference: string) {
  await page.getByRole("button", { name: /scan receipt or logbook page/i }).click();
  const dialog = page.getByRole("dialog", { name: "Snap Receipt" });
  await dialog.getByLabel("Mileage", { exact: true }).fill("91000");
  await dialog.getByLabel("Garage Name", { exact: true }).fill("Narrow Phone Layout Workshop");
  await dialog
    .getByLabel("Work Description", { exact: true })
    .fill("Narrow phone overflow layout fixture");
  await dialog
    .getByLabel("OEM Part Numbers (name | part no.)", { exact: true })
    .fill(`Layout fixture component | ${partReference}`);
  await dialog.getByRole("button", { name: "Save to Timeline" }).click();
  await expect(dialog).toBeHidden();
}

async function renderVerificationQr(page: Page) {
  const qrSvg = await QRCode.toString("https://v5vault.app/verify/mobile-layout", {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 0,
    width: 90,
  });
  await page.locator(".passport-document header aside").evaluate((aside, svg) => {
    aside.innerHTML = `${svg}<p class="max-w-full break-words text-[9px] font-extrabold leading-tight">Scan to Verify Authenticity</p><p class="mt-1 max-w-full break-words text-[8px]">Latest workshop stamp</p>`;
  }, qrSvg);
}

test("browser Back closes the active dialog before leaving its route", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await startSamplePreview(page);

  await page.getByRole("button", { name: /Audi A4/ }).click();
  await page.getByRole("menuitem", { name: /Connect New Vehicle/ }).click();
  const dialog = page.getByRole("dialog", { name: "Connect New Vehicle" });
  await expect(dialog).toBeVisible();

  await page.goBack();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/vehicle$/);
});

test("vehicle header plate and status matrix fit at 375px", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await startSamplePreview(page);
  await checkPageHasNoHorizontalOverflow(page, "vehicle header at 375px");

  const plate = page.locator(".uk-plate").first();
  await expect(plate).toBeVisible();
  await expect(plate).toHaveCSS("height", "36px");
  const plateDetails = await plate.evaluate((element) => {
    const band = element.firstElementChild!;
    const text = element.lastElementChild!;
    const outer = element.getBoundingClientRect();
    const bandBounds = band.getBoundingClientRect();
    const textBounds = text.getBoundingClientRect();
    return {
      outerLeft: outer.left,
      outerTop: outer.top,
      borderLeft: parseFloat(getComputedStyle(element).borderLeftWidth),
      borderTop: parseFloat(getComputedStyle(element).borderTopWidth),
      bandLeft: bandBounds.left,
      bandTop: bandBounds.top,
      bandHeight: bandBounds.height,
      textFontSize: getComputedStyle(text).fontSize,
    };
  });
  expect(plateDetails.bandLeft).toBeCloseTo(plateDetails.outerLeft + plateDetails.borderLeft, 1);
  expect(plateDetails.bandTop).toBeCloseTo(plateDetails.outerTop + plateDetails.borderTop, 1);
  expect(plateDetails.textFontSize).toBe("16px");
  const pillRow = page.getByTestId("vehicle-status-pills");
  await expect(pillRow.getByText("Keeper Unverified", { exact: true })).toBeVisible();
  await expect(pillRow.getByText(/V5C (Verified|Provisional)/)).toBeVisible();
  const pillRects = await pillRow.locator(":scope > *").evaluateAll((items) =>
    items.map((item) => {
      const { top, left, width, height } = item.getBoundingClientRect();
      return { label: item.textContent?.trim(), top, left, width, centerY: top + height / 2 };
    }),
  );
  expect(pillRects).toHaveLength(4);
  expect(Math.max(...pillRects.map((item) => item.width)) - Math.min(...pillRects.map((item) => item.width))).toBeLessThanOrEqual(1);
  expect(await pillRow.evaluate((row) => row.getBoundingClientRect().width)).toBeLessThanOrEqual(320);
  const visiblePills = await pillRow.locator(":scope > span").evaluateAll((items) =>
    items.map((item) => getComputedStyle(item).height),
  );
  expect(visiblePills).toEqual(["30px", "30px"]);
  expect(Math.abs(pillRects[0].centerY - pillRects[1].centerY)).toBeLessThanOrEqual(1);
  expect(Math.abs(pillRects[2].centerY - pillRects[3].centerY)).toBeLessThanOrEqual(1);
  expect(pillRects[2].top).toBeGreaterThan(pillRects[0].top);
  expect(pillRects[0].left).toBeLessThan(pillRects[1].left);
  expect(pillRects[2].left).toBeLessThan(pillRects[3].left);
});

for (const viewport of viewports) {
  test(`modification date and mileage fields fit at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await startSamplePreview(page);
    await selectTier(page, /Pro Modder/);
    await page.goto("/vault");
    await page.getByRole("button", { name: "Add Modification", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Add Modification" });
    await expect(dialog).toBeVisible();
    await checkPair(dialog, "Install Date", "Install Mileage", viewport.mobile);
    const date = dialog.getByLabel("Install Date", { exact: true });
    await expect(date).toHaveCSS("appearance", "none");
    await expect(date).toHaveCSS("height", "44px");
    await expect(dialog).toHaveCSS("padding", "20px");
    await page.screenshot({ path: `test-results/modification-${viewport.width}.png` });
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toBeHidden();
  });

  test(`mobile forms and nested upgrade fit at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await startSamplePreview(page);

    // Pro DIY exposes all three real two-column field groups in Snap Receipt.
    await selectTier(page, /Pro DIY/);
    await page.getByRole("button", { name: /scan receipt or logbook page/i }).click();
    const proReceipt = page.getByRole("dialog", { name: "Snap Receipt" });
    await expect(proReceipt).toBeVisible();
    await checkDialogViewport(page, proReceipt);
    await checkPair(proReceipt, "Date", "Mileage", viewport.mobile);
    await checkPair(proReceipt, "Category", "Garage Name", viewport.mobile);
    await checkPair(proReceipt, "Parts (£)", "Labour (£)", viewport.mobile);

    await proReceipt.getByRole("button", { name: "Close" }).click();
    await expect(proReceipt).toBeHidden();
    await waitForClosedDialogOverlays(page);

    // Manual DIY entry is a separate form with optional proof uploads.
    await selectTier(page, /Basic Driver \(Free\)/);
    await page.getByRole("button", { name: /add new repair \/ service record/i }).click();
    const manualEntry = page.getByRole("dialog", { name: "Add a Basic DIY Service Entry" });
    await expect(manualEntry).toBeVisible();
    await expect(manualEntry.getByText("Photo / Image")).toBeVisible();
    await expect(manualEntry.getByText("PDF Document")).toBeVisible();
    await expect(manualEntry.getByLabel("Work performed", { exact: true })).toBeEnabled();
    await manualEntry.getByRole("button", { name: "Close" }).click();
    await expect(manualEntry).toBeHidden();
    await waitForClosedDialogOverlays(page);

    // Receipt entry remains camera-first and its locked cost breakdown opens Pro DIY.
    await page.getByRole("button", { name: /scan receipt or logbook page/i }).click();
    const receipt = page.getByRole("dialog", { name: "Snap Receipt" });
    await expect(receipt).toBeVisible();
    const upgradeTrigger = receipt.getByRole("button", { name: /Parts vs labour cost/ });
    await clickNestedDialogTrigger(page, upgradeTrigger);
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
    await checkDialogViewport(page, upgrade);
    await checkCloseFocus(page, upgrade);

    await upgrade.getByRole("button", { name: "Close" }).click();
    await expect(upgrade).toBeHidden();
    await expect(receipt).toBeVisible();
    await expect(upgradeTrigger).toBeFocused();
    await checkDialogViewport(page, receipt);
    await expect(openBackdrops).toHaveCount(1);
    await waitForClosedDialogOverlays(page);

    // Escape must dismiss only the active child, not its mounted parent.
    await clickNestedDialogTrigger(page, upgradeTrigger);
    await expect(upgrade).toBeVisible();
    await checkDialogViewport(page, upgrade);
    await checkCloseFocus(page, upgrade);
    await page.keyboard.press("Escape");
    await expect(upgrade).toBeHidden();
    await expect(receipt).toBeVisible();
    await expect(upgradeTrigger).toBeFocused();
    await receipt.getByRole("button", { name: "Close" }).click();
    await expect(receipt).toBeHidden();
    await waitForClosedDialogOverlays(page);
    await expect(openBackdrops).toHaveCount(0);

    // The development fixture supplies the V5C reference server-side.
    await page.getByRole("button", { name: /Audi A4/ }).click();
    await page.getByRole("menuitem", { name: /Connect New Vehicle/ }).click();
    const vehicleDialog = page.getByRole("dialog", { name: "Connect New Vehicle" });
    await expect(vehicleDialog).toBeVisible();
    await checkDialogViewport(page, vehicleDialog);
    await vehicleDialog.getByLabel("Vehicle registration mark", { exact: true }).fill("LG57 VYF");
    await focusAndCheck(vehicleDialog, "Vehicle registration mark", viewport.mobile);
    await expect(vehicleDialog.getByLabel("11-digit V5C logbook reference", { exact: true })).toHaveCount(0);
    await expect(vehicleDialog).toContainText("Development first-claim rule");
    await vehicleDialog.getByLabel("VIN / chassis number on your V5C", { exact: true }).fill("WUAZZZ8EX8A800721");
    await focusAndCheck(vehicleDialog, "VIN / chassis number on your V5C", viewport.mobile);
    await checkCloseFocus(page, vehicleDialog);
    await vehicleDialog.getByRole("button", { name: "Close" }).click();
    await expect(vehicleDialog).toBeHidden();
    await expect(openBackdrops).toHaveCount(0);
  });
}

async function waitForClosedDialogOverlays(page: Page) {
  await expect(page.locator('[data-state="closed"][class*="fixed"][class*="inset-0"]')).toHaveCount(0);
}

async function clickNestedDialogTrigger(page: Page, trigger: Locator) {
  await expect(trigger).toBeVisible();
  await trigger.scrollIntoViewIfNeeded();
  const box = await trigger.boundingBox();
  if (!box) throw new Error("The nested-dialog trigger is not visible.");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

async function checkDialogViewport(page: Page, dialog: Locator) {
  // Poll through the opening transition before measuring the sheet.
  await expect(async () => {
    expectInside(await bounds(dialog), await visibleViewport(page));
  }).toPass();
}

// Playwright cannot open a native phone keyboard. Resize only visualViewport
// instead: unlike setViewportSize, this leaves innerHeight/dvh at 640px, matching
// the keyboard behavior on iOS and modern Android browsers.
async function setKeyboardViewport(page: Page, open: boolean) {
  await page.evaluate((keyboardOpen) => {
    const viewport = window.visualViewport;
    if (!viewport) throw new Error("These keyboard checks require visualViewport");
    for (const [key, value] of Object.entries({ height: 340, offsetTop: 20 })) {
      if (keyboardOpen) Object.defineProperty(viewport, key, { configurable: true, value });
      else Reflect.deleteProperty(viewport, key);
    }
    viewport.dispatchEvent(new Event("resize"));
    viewport.dispatchEvent(new Event("scroll"));
  }, open);
  expect(await page.evaluate(() => window.innerHeight)).toBe(640);
  expect((await visibleViewport(page)).bottom).toBe(open ? 360 : 640);
}

async function scrollFocusedField(dialog: Locator, label: string) {
  const field = dialog.getByLabel(label, { exact: true });
  await field.focus();
  await field.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await expect(field).toBeFocused();
  await expect(async () => {
    const scroller = dialog.locator("form > .overflow-y-auto");
    // Safari rounds the focused control to a fractional CSS pixel at the top
    // edge; keep a 2px boundary allowance while still containing its border.
    expectInside(await bounds(field), await bounds(scroller), 2);
    expectInside(await bounds(field), await visibleViewport(dialog.page()), 3);
  }).toPass();
  return field;
}

async function dismissKeyboardAndCheckAction(page: Page, dialog: Locator, name: string) {
  await dialog.locator(":focus").evaluate((element) =>
    (element as HTMLElement).blur(),
  );
  await setKeyboardViewport(page, false);
  await checkDialogViewport(page, dialog);
  const action = dialog.getByRole("button", { name, exact: true });
  await expect(action).toBeEnabled();
  await action.focus();
  await expect(action).toBeFocused();
  expectInside(await bounds(action), await visibleViewport(page), 3);
  // Check actual pointer reachability without creating a service record/claim.
  await action.click({ trial: true });
}

test("service forms stay usable with a keyboard on a short portrait phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await startSamplePreview(page);
  await selectTier(page, /Pro DIY/);
  await page.getByRole("button", { name: /scan receipt or logbook page/i }).click();
  const receipt = page.getByRole("dialog", { name: "Snap Receipt" });
  const mileage = receipt.getByLabel("Mileage", { exact: true });
  await mileage.fill("87420");
  await setKeyboardViewport(page, true);
  await expect(mileage).toBeFocused();
  await checkDialogViewport(page, receipt);
  await scrollFocusedField(receipt, "Mileage");
  await scrollFocusedField(receipt, "Garage Name");
  await scrollFocusedField(receipt, "Work Description");
  await scrollFocusedField(receipt, "Fluid Specs");
  await scrollFocusedField(receipt, "Labour (£)");
  const receiptScroller = receipt.locator("form > .overflow-y-auto");
  expect(await receiptScroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await dismissKeyboardAndCheckAction(page, receipt, "Save to Timeline");
  await expect(mileage).toHaveValue("87420");
  await receipt.getByRole("button", { name: "Close", exact: true }).click();
  await expect(receipt).toBeHidden();

  await page.getByRole("button", { name: /Audi A4/ }).click();
  await page.getByRole("menuitem", { name: /Connect New Vehicle/ }).click();
  const vehicle = page.getByRole("dialog", { name: "Connect New Vehicle" });
  await vehicle.getByLabel("Vehicle registration mark", { exact: true }).fill("LG57 VYF");
  await expect(vehicle.getByLabel("11-digit V5C logbook reference", { exact: true })).toHaveCount(0);
  const vinInput = vehicle.getByLabel("VIN / chassis number on your V5C", { exact: true });
  await vinInput.fill("WUAZZZ8EX8A800721");
  await setKeyboardViewport(page, true);
  await expect(vinInput).toBeFocused();
  await checkDialogViewport(page, vehicle);
  const vin = await scrollFocusedField(vehicle, "VIN / chassis number on your V5C");
  await dismissKeyboardAndCheckAction(page, vehicle, "Connect vehicle passport");
  await expect(vin).toHaveValue("WUAZZZ8EX8A800721");
  await vehicle.getByRole("button", { name: "Close", exact: true }).click();
  await expect(vehicle).toBeHidden();
});

test("nested upgrade dismisses after the receipt form scrolls on a short phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await startSamplePreview(page);
  await selectTier(page, /Basic Driver \(Free\)/);
  await page.getByRole("button", { name: /scan receipt or logbook page/i }).click();
  const receipt = page.getByRole("dialog", { name: "Snap Receipt" });
  await receipt.getByLabel("Work Description", { exact: true }).focus();
  await setKeyboardViewport(page, true);
  await checkDialogViewport(page, receipt);
  await scrollFocusedField(receipt, "Work Description");
  const scroller = receipt.locator("form > .overflow-y-auto");
  const trigger = receipt.getByRole("button", { name: /Parts vs labour cost/ });
  await trigger.scrollIntoViewIfNeeded();
  expect(await scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  const upgrade = page.getByRole("dialog", { name: /Upgrade to Pro DIY/ });
  for (const dismissal of ["Close", "Escape"]) {
    await trigger.click();
    await expect(upgrade).toBeVisible();
    await checkDialogViewport(page, upgrade);
    await checkCloseFocus(page, upgrade);
    if (dismissal === "Close") await upgrade.getByRole("button", { name: "Close" }).click();
    else await page.keyboard.press("Escape");
    await expect(upgrade).toBeHidden();
    await expect(receipt).toBeVisible();
    await expect(trigger).toBeFocused();
    expectInside(await bounds(trigger), await bounds(scroller), 3);
    expectInside(await bounds(trigger), await visibleViewport(page), 3);
  }
  await setKeyboardViewport(page, false);
  await checkDialogViewport(page, receipt);
  await receipt.getByRole("button", { name: "Close", exact: true }).click();
  await expect(receipt).toBeHidden();
  await expect(page.locator('[data-state="open"][class*="fixed"][class*="inset-0"]')).toHaveCount(0);
});

for (const width of [320, 390]) {
  test(`passport certificates and shared parts fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await startSamplePreview(page);
    await selectTier(page, /Pro Modder/);

    const longPartReference = `LONGPARTREF-${"0123456789".repeat(4)}01234567`;
    await addLongPartFixture(page, longPartReference);
    await page.getByRole("link", { name: "Passport", exact: true }).click();
    await expect(page).toHaveURL(/\/passport$/);

    const certificates = [
      { title: "Standard Passport", hasParts: false },
      { title: "OEM Provenance Certificate", hasParts: true },
      { title: "Master Build Sheet", hasParts: true },
    ];

    for (const certificate of certificates) {
      await page.getByRole("button", { name: certificate.title, exact: false }).click();
      const document = page.locator(".passport-document");
      await expect(document.locator("header p.text-primary")).toHaveText(certificate.title);
      await renderVerificationQr(page);
      await checkPageHasNoHorizontalOverflow(page, `${certificate.title} at ${width}px`);
      await expect(document).toHaveCSS("min-width", "0px");

      const verificationCard = document.locator("header aside");
      const qr = verificationCard.locator("svg");
      await expect(qr).toBeVisible();
      await checkInsideParent(verificationCard, `${certificate.title} verification card`);
      await checkInsideParent(qr, `${certificate.title} QR code`);

      if (certificate.hasParts) {
        const partReference = document.locator(".passport-part-card p.font-mono").filter({
          hasText: longPartReference,
        });
        await expect(partReference).toBeVisible();
        await checkInsideParent(partReference, `${certificate.title} part reference`);
      }
    }

    await page.goto("/v/AB14CDE?sample=true");
    await expect(page.getByRole("heading", { name: "Parts Breakdown" }).first()).toBeVisible();
    await checkPageHasNoHorizontalOverflow(page, `shared buyer passport at ${width}px`);
    const sharedPartReferences = page.locator("main p.font-mono");
    await expect(sharedPartReferences.first()).toBeVisible();
    for (let index = 0; index < (await sharedPartReferences.count()); index += 1) {
      await checkInsideParent(
        sharedPartReferences.nth(index),
        `shared passport part reference ${index + 1}`,
      );
    }
  });
}

test("passport views reflow with enlarged text on a phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await startSamplePreview(page);
  await selectTier(page, /Pro Modder/);
  await page.goto("/passport");
  const document = page.locator(".passport-document");
  await page.getByRole("button", { name: "Standard Passport", exact: false }).click();
  await expect(document.locator("header p.text-primary")).toHaveText("Standard Passport");
  await increasePageTextScale(page);
  await checkPageHasNoHorizontalOverflow(page, "passport certificate at 150% text size");

  const certificateChoices = [
    "Standard Passport",
    "OEM Provenance Certificate",
    "Master Build Sheet",
  ];
  for (const title of certificateChoices) {
    const choice = page.getByRole("button", { name: title, exact: false });
    await expect(choice).toBeVisible();
    await checkInsideParent(choice, `${title} choice at enlarged text size`);
    if (title !== "Standard Passport") await choice.click();
    await expect(document.locator("header p.text-primary")).toHaveText(title);
    await expect(document.locator("header h2")).toHaveCSS("font-size", "30px");
    const download = document.getByRole("button", { name: "Download PDF" });
    await expect(download).toBeVisible();
    await checkInsideParent(
      document.locator("header p.text-primary"),
      `${title} heading at enlarged text size`,
    );
    await checkInsideParent(download, `${title} download control at enlarged text size`);
    await checkPageHasNoHorizontalOverflow(page, `${title} at 150% text size`);
  }

  await page.goto("/v/AB14CDE?sample=true");
  await expect(page.getByRole("heading", { name: "Parts Breakdown" }).first()).toBeVisible();
  await increasePageTextScale(page);
  await expect(page.getByRole("heading", { name: "MOT mileage trend" })).toBeVisible();
  await expect(page.getByText(/Keeper contact details and V5C reference are never displayed/)).toBeVisible();
  await expect(page.getByText("Important: not government certification")).toBeVisible();
  await checkInsideParent(
    page.getByRole("heading", { name: /Audi A4/ }),
    "public passport vehicle heading at enlarged text size",
  );
  await expect(page.getByRole("heading", { name: /Audi A4/ })).toHaveCSS("font-size", "45px");
  await checkInsideParent(
    page.getByText(/Keeper contact details and V5C reference are never displayed/),
    "public passport privacy notice at enlarged text size",
  );
  await checkInsideParent(
    page.getByText("Important: not government certification"),
    "public passport certification notice at enlarged text size",
  );
  await checkPageHasNoHorizontalOverflow(page, "public passport at 150% text size");
});

async function checkCloseFocus(page: Page, dialog: Locator) {
  const close = dialog.getByRole("button", { name: "Close", exact: true });
  await close.focus();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Shift+Tab");
  await expect(close).toBeFocused();
  await expect(close).toHaveCSS("box-shadow", /^(?!none$).+/);
  expectInside(await bounds(close), await bounds(dialog), 3);
  expectInside(await bounds(close), await visibleViewport(page), 3);
}

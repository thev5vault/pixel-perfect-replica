import { expect, test, type Page } from "@playwright/test";
import QRCode from "qrcode";
import { getDocument, OPS } from "pdfjs-dist/legacy/build/pdf.mjs";

const longRecordMarker = "PRINT-LONG-RECORD";
const longRecordEnd = "PRINT-LONG-RECORD-END";
const longDescription = `${longRecordMarker} ${"Extended inspection notes confirm all checks were completed and recorded for this service. ".repeat(100)}${longRecordEnd}`;

async function startSamplePreview(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Direct GodMode Bypass/ }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole("link", { name: "Vehicle", exact: true }).click();
  await expect(page).toHaveURL(/\/vehicle$/);
  await expect(page.getByRole("button", { name: "Open profile menu" })).toBeVisible();
}

async function selectProTier(page: Page) {
  await page.getByRole("button", { name: "Open profile menu" }).click();
  await page.getByRole("menuitem", { name: /Pro Modder/ }).click();
  await expect(page.getByRole("button", { name: "Open profile menu" })).toBeVisible();
}

async function addPrintFixtureService(page: Page) {
  await page.goto("/vehicle");
  await page.getByRole("button", { name: "Snap Receipt", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Snap Receipt" });
  await dialog.getByLabel("Mileage", { exact: true }).fill("91000");
  await dialog.getByLabel("Garage Name", { exact: true }).fill("Print Layout Test Workshop");
  await dialog
    .getByLabel("Work Description", { exact: true })
    .fill("PRINT-LONG-RECORD workshop inspection and repair");
  await dialog.getByLabel("OEM Part Numbers (name | part no.)", { exact: true }).fill(
    Array.from({ length: 20 }, (_, index) => {
      const item = String(index + 1).padStart(2, "0");
      return `Print fixture component ${item} | PRINTREF${item}`;
    }).join("\n"),
  );
  await dialog.getByLabel("Parts (£)", { exact: true }).fill("1250.00");
  await dialog.getByLabel("Labour (£)", { exact: true }).fill("750.00");
  await dialog.getByRole("button", { name: "Save to Timeline" }).click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByText("PRINT-LONG-RECORD workshop inspection and repair", { exact: true }),
  ).toBeVisible();
}

async function expandRenderedDescription(page: Page, qrSvg: string) {
  await page.locator(".passport-document").evaluate(
    (document, fixture) => {
      const card = Array.from(document.querySelectorAll<HTMLElement>(".passport-record-card")).find(
        (candidate) => candidate.textContent?.includes("PRINT-LONG-RECORD"),
      );
      const workSummary =
        card &&
        Array.from(card.querySelectorAll<HTMLElement>("div")).find(
          (candidate) => candidate.children[0]?.textContent?.trim() === "Work summary",
        );
      const summary = workSummary?.querySelectorAll("p")[1];
      if (!summary) throw new Error("The print fixture service summary was not rendered.");
      summary.textContent = fixture.longDescription;

      const detailedDescription = Array.from(
        document.querySelectorAll<HTMLElement>(".passport-service-description"),
      ).find((candidate) => candidate.textContent?.includes("PRINT-LONG-RECORD"));
      if (detailedDescription) detailedDescription.textContent = fixture.longDescription;

      const verification = document.querySelector<HTMLElement>(".passport-document header aside");
      if (!verification) throw new Error("The certificate verification area was not rendered.");
      verification.innerHTML = `${fixture.qrSvg}<p class="max-w-full break-words text-[9px] font-extrabold leading-tight">Scan to Verify Authenticity</p><p class="mt-1 max-w-full break-words text-[8px]">Latest workshop stamp</p>`;
    },
    { longDescription, qrSvg },
  );
}

async function makePdfTextPages(pdfBytes: Uint8Array) {
  const pdf = await getDocument({ data: pdfBytes }).promise;
  const pageTexts: string[] = [];
  const pageBounds: {
    width: number;
    height: number;
    imagePaintCount: number;
    textBoxes: { x: number; y: number; width: number; height: number; text: string }[];
  }[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const content = await page.getTextContent();
    const operators = await page.getOperatorList();
    const imagePaintCount = operators.fnArray.filter(
      (operation) =>
        operation === OPS.paintImageXObject ||
        operation === OPS.paintInlineImageXObject ||
        operation === OPS.paintImageMaskXObject,
    ).length;
    const items = content.items as Array<{
      str?: string;
      transform?: number[];
      width?: number;
      height?: number;
    }>;
    const textItems = items.filter(
      (item) => typeof item.str === "string" && item.str.trim().length > 0,
    );
    pageTexts.push(textItems.map((item) => item.str).join(" "));
    pageBounds.push({
      width: viewport.width,
      height: viewport.height,
      imagePaintCount,
      textBoxes: textItems.flatMap((item) => {
        const x = item.transform?.[4];
        const y = item.transform?.[5];
        if (x === undefined || y === undefined) return [];
        return [{ x, y, width: item.width ?? 0, height: item.height ?? 0, text: item.str ?? "" }];
      }),
    });
  }
  return { pageTexts, pageBounds };
}

test("Standard, OEM and Master certificates keep long records readable in printed PDFs", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "chromium", "Playwright's PDF export is supported only in Chromium.");
  test.setTimeout(90_000);
  await startSamplePreview(page);
  await selectProTier(page);
  await addPrintFixtureService(page);

  const qrSvg = await QRCode.toString("https://v5vault.app/verify/print-fixture", {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 0,
    width: 90,
  });

  const certificates = [
    { name: "Standard Passport", financials: false, parts: false, receipts: 0, dynoImages: 0 },
    {
      name: "OEM Provenance Certificate",
      financials: true,
      parts: true,
      receipts: 2,
      dynoImages: 0,
    },
    { name: "Master Build Sheet", financials: true, parts: true, receipts: 2, dynoImages: 1 },
  ];

  await page.getByRole("link", { name: "Passport", exact: true }).click();
  for (const certificate of certificates) {
    await page.getByRole("button", { name: certificate.name, exact: false }).click();
    await expect(page.locator(".passport-document header h2")).toHaveText(
      certificate.name,
    );
    await expect(page.locator(".passport-document")).toContainText("Service History");
    await expect(
      page.locator(".passport-document .passport-record-card").filter({
        hasText: "PRINT-LONG-RECORD",
      }),
    ).toBeVisible();
    await expandRenderedDescription(page, qrSvg);

    await page.emulateMedia({ media: "print" });
    const printLayout = await page.locator(".passport-document").evaluate((document) => {
      const summary = Array.from(
        document.querySelectorAll<HTMLElement>(".passport-record-card p"),
      ).find((paragraph) => paragraph.textContent?.includes("PRINT-LONG-RECORD"));
      const qr = document.querySelector("header aside svg");
      const verification = document.querySelector("header aside");
      return {
        summaryFontSize: summary ? Number.parseFloat(getComputedStyle(summary).fontSize) : 0,
        qrWidth: qr?.getBoundingClientRect().width ?? 0,
        verificationWidth: verification?.getBoundingClientRect().width ?? 0,
        verificationText: verification?.textContent ?? "",
      };
    });
    expect(
      printLayout.summaryFontSize,
      `${certificate.name} service text should remain readable`,
    ).toBeGreaterThanOrEqual(12);
    expect(
      printLayout.qrWidth,
      `${certificate.name} verification QR should be present`,
    ).toBeGreaterThan(0);
    expect(printLayout.qrWidth).toBeLessThanOrEqual(printLayout.verificationWidth);
    expect(printLayout.verificationText).toContain("Scan to Verify Authenticity");

    const imageLayout = await page
      .locator(
        ".passport-document .passport-receipt-image img, .passport-document .passport-dyno-photo",
      )
      .evaluateAll(async (images) => {
        return Promise.all(
          images.map(async (element) => {
            if (!(element instanceof HTMLImageElement)) {
              throw new Error("A print evidence image is not an image element.");
            }
            element.loading = "eager";
            await element.decode();
            const rect = element.getBoundingClientRect();
            const documentRect = element.closest(".passport-document")!.getBoundingClientRect();
            const wrapper = element.closest(".passport-receipt-image, .passport-dyno-image");
            return {
              alt: element.alt,
              width: rect.width,
              height: rect.height,
              naturalWidth: element.naturalWidth,
              naturalHeight: element.naturalHeight,
              insideCertificate:
                rect.left >= documentRect.left &&
                rect.top >= documentRect.top &&
                rect.right <= documentRect.right &&
                rect.bottom <= documentRect.bottom,
              aspectRatio: rect.width / rect.height,
              naturalAspectRatio: element.naturalWidth / element.naturalHeight,
              objectFit: getComputedStyle(element).objectFit,
              breakInside: wrapper ? getComputedStyle(wrapper).breakInside : "",
              isDyno: element.classList.contains("passport-dyno-photo"),
            };
          }),
        );
      });
    const receiptImages = imageLayout.filter((image) => !image.isDyno);
    const dynoImages = imageLayout.filter((image) => image.isDyno);
    expect(receiptImages, `${certificate.name} receipt image count`).toHaveLength(
      certificate.receipts,
    );
    expect(dynoImages, `${certificate.name} dyno image count`).toHaveLength(certificate.dynoImages);
    for (const image of imageLayout) {
      expect(image.naturalWidth).toBeGreaterThan(0);
      expect(image.naturalHeight).toBeGreaterThan(0);
      expect(image.width).toBeGreaterThan(100);
      expect(image.height).toBeGreaterThan(100);
      expect(image.insideCertificate).toBe(true);
      expect(image.objectFit).toBe("contain");
      expect(image.breakInside).toContain("avoid");
      expect(
        Math.abs(image.aspectRatio - image.naturalAspectRatio),
        `${image.alt} should keep its full aspect ratio`,
      ).toBeLessThan(0.03);
      if (image.isDyno) {
        expect(image.height).toBeLessThanOrEqual((100 * 96) / 25.4 + 1);
      } else {
        expect(image.width).toBeLessThanOrEqual((86 * 96) / 25.4 + 1);
        expect(image.height).toBeLessThanOrEqual((82 * 96) / 25.4 + 1);
      }
    }

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
    });
    const { pageTexts, pageBounds } = await makePdfTextPages(new Uint8Array(pdfBuffer));
    const imagePaintCount = pageBounds.reduce((count, bounds) => count + bounds.imagePaintCount, 0);
    const allText = pageTexts.join(" ").replace(/\s+/g, " ");
    const upperText = allText.toUpperCase();
    expect(
      pageTexts.length,
      `${certificate.name} should continue long records onto another page`,
    ).toBeGreaterThan(1);
    expect(allText).toContain("Scan to Verify Authenticity");
    expect(allText).toContain("Latest workshop stamp");
    expect(allText).toContain("PRINT-LONG-RECORD");
    expect(allText).toContain("PRINT-LONG-RECORD-END");
    expect(
      imagePaintCount,
      `${certificate.name} evidence images should be present in the PDF`,
    ).toBeGreaterThanOrEqual(certificate.receipts + certificate.dynoImages);

    const startPage = pageTexts.findIndex((text) => text.includes("PRINT-LONG-RECORD"));
    const endPage = pageTexts.findIndex((text) => text.includes("PRINT-LONG-RECORD-END"));
    expect(startPage).toBeGreaterThanOrEqual(0);
    expect(
      endPage,
      `${certificate.name} long description should reach a later page`,
    ).toBeGreaterThan(startPage);

    if (certificate.financials) {
      expect(allText).toContain("Financial Summary");
      expect(allText).toContain("Total Spend");
      expect(allText).toContain("£1250.00");
      expect(allText).toContain("£750.00");
      expect(allText).toContain("£2000.00");
    }
    if (certificate.parts) {
      expect(upperText).toContain("PARTS BREAKDOWN");
      expect(upperText).toContain("MANUFACTURER REFERENCE");
      expect(upperText).toContain("PRINTREF20");
    }

    for (const [pageIndex, bounds] of pageBounds.entries()) {
      for (const textBox of bounds.textBoxes) {
        expect(
          textBox.x,
          `${certificate.name} page ${pageIndex + 1} text should stay inside the left print margin`,
        ).toBeGreaterThanOrEqual(24);
        expect(
          textBox.x + textBox.width,
          `${certificate.name} page ${pageIndex + 1} text should stay inside the right print margin: ${textBox.text}`,
        ).toBeLessThanOrEqual(bounds.width - 16);
        expect(
          textBox.y,
          `${certificate.name} page ${pageIndex + 1} text should stay above the bottom print margin: ${textBox.text}`,
        ).toBeGreaterThanOrEqual(24);
        expect(
          textBox.y + textBox.height,
          `${certificate.name} page ${pageIndex + 1} text should stay below the top print margin`,
        ).toBeLessThanOrEqual(bounds.height - 24);
      }
    }

    await page.emulateMedia({ media: "screen" });
  }
});

import { expect, test } from "@playwright/test";

test("local invoice OCR works in iPhone WebKit without Tesseract CDN requests", async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== "webkit", "This smoke test targets mobile Safari/WebKit.");
  test.setTimeout(120_000);

  const localOcrRequests = new Set<string>();
  const externalOcrRequests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith("/ocr/")) localOcrRequests.add(url.pathname);
    if (/cdn\.jsdelivr\.net\/npm\/(?:tesseract\.js|tesseract\.js-core|@tesseract\.js-data)\//.test(request.url()) ||
        /tessdata\.projectnaptha\.com/.test(request.url())) {
      externalOcrRequests.push(request.url());
    }
  });

  await page.goto("/", { waitUntil: "domcontentloaded" });
  const recognizedText = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1000;
    canvas.height = 220;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable in WebKit.");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#111";
    context.font = "64px Arial, sans-serif";
    context.fillText("MILEAGE 86420", 32, 135);
    const image = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not create OCR smoke-test image.")), "image/png");
    });
    const { readInvoiceText } = await import("/src/services/invoice-ocr.ts");
    return (await readInvoiceText(image)).text;
  });

  expect(recognizedText).toMatch(/86420/);
  expect(localOcrRequests).toContain("/ocr/worker.min.js");
  expect(localOcrRequests).toContain("/ocr/tesseract-core-lstm.wasm.js");
  expect(localOcrRequests).toContain("/ocr/lang/eng.traineddata.gz");
  expect(externalOcrRequests).toEqual([]);
});

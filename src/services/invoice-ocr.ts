export type InvoiceSuggestions = {
  mileage?: string;
  date?: string;
  category?: string;
  components?: string[];
  notes?: string;
  partsCost?: string;
  labourCost?: string;
};

export type InvoiceOcrProgress = (message: string) => void;

const MAX_PDF_PAGES = 3;
const MAX_IMAGE_EDGE = 1800;

function toIsoDate(day: number, month: number, year: number): string | undefined {
  const fullYear = year < 100 ? (year < 70 ? 2000 + year : 1900 + year) : year;
  const date = new Date(Date.UTC(fullYear, month - 1, day));
  if (date.getUTCFullYear() !== fullYear || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return `${fullYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function extractDate(text: string): string | undefined {
  const labelled = text.match(/(?:invoice\s*)?date\s*[:#-]?\s*(\d{1,2}[/. -]\d{1,2}[/. -]\d{2,4})/i)?.[1];
  const numeric = labelled ?? text.match(/\b(\d{1,2}[/. -]\d{1,2}[/. -]\d{2,4})\b/)?.[1];
  if (numeric) {
    const parts = numeric.split(/[/. -]/).map(Number);
    const [day, month, year] = parts;
    if (day && month && year) return toIsoDate(day, month, year);
  }
  const textual = text.match(/\b(\d{1,2})\s+(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{4})\b/i);
  if (!textual) return undefined;
  const month = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
    .findIndex((prefix) => textual[2]!.toLowerCase().startsWith(prefix)) + 1;
  return toIsoDate(Number(textual[1]), month, Number(textual[3]));
}

function extractMoney(text: string, label: RegExp): string | undefined {
  const match = text.match(label);
  if (!match?.[1]) return undefined;
  const amount = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(amount) && amount >= 0 && amount <= 1_000_000 ? amount.toFixed(2) : undefined;
}

export function parseInvoiceText(
  rawText: string,
  categories: readonly string[],
  knownComponents: readonly string[],
): InvoiceSuggestions {
  const text = rawText.replace(/\r/g, "\n").replace(/[ \t]+/g, " ");
  const suggestions: InvoiceSuggestions = {};
  const mileage = text.match(/(?:odometer|mileage|milage|miles)\D{0,24}([\d,]{4,8})/i)?.[1];
  if (mileage) {
    const numeric = Number(mileage.replace(/,/g, ""));
    if (Number.isInteger(numeric) && numeric >= 0 && numeric <= 2_000_000) suggestions.mileage = String(numeric);
  }

  const date = extractDate(text);
  if (date) suggestions.date = date;

  const lower = text.toLowerCase();
  const categoryMatch = categories.find((category) => {
    const key = category.toLowerCase();
    return lower.includes(key) || (key === "servicing" && /\b(service|oil change|scheduled maintenance)\b/i.test(text)) ||
      (key === "tyres" && /\b(tyre|tire|puncture|wheel alignment)\b/i.test(text));
  });
  if (categoryMatch) suggestions.category = categoryMatch;

  const foundComponents = knownComponents.filter((component) => lower.includes(component.toLowerCase()));
  if (foundComponents.length) suggestions.components = foundComponents;

  const partsCost = extractMoney(text, /(?:parts(?:\s+(?:cost|total))?|spare parts)\s*(?:total|cost)?\s*[:\-]?\s*(?:GBP|£)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  const labourCost = extractMoney(text, /(?:labou?r(?:\s+(?:cost|total))?|work charges)\s*(?:total|cost)?\s*[:\-]?\s*(?:GBP|£)?\s*([\d,]+(?:\.\d{1,2})?)/i);
  if (partsCost) suggestions.partsCost = partsCost;
  if (labourCost) suggestions.labourCost = labourCost;

  const excluded = /\b(invoice|receipt|vat|tax|subtotal|total|balance|payment|thank you|telephone|phone|email|address|postcode|registration|vrm|mileage|odometer|date)\b/i;
  const workLines = text.split("\n")
    .map((line) => line.trim().replace(/\s+/g, " "))
    .filter((line) => line.length >= 5 && line.length <= 160 && !excluded.test(line))
    .filter((line) => /\b(replac|fit|inspect|service|oil|filter|brake|tyre|tire|battery|coolant|suspension|repair|flush|diagnos|labou?r)\b/i.test(line));
  if (workLines.length) suggestions.notes = [...new Set(workLines)].slice(0, 8).join("\n").slice(0, 1600);

  return suggestions;
}

async function imageCanvas(blob: Blob): Promise<HTMLCanvasElement> {
  let source: ImageBitmap | HTMLImageElement;
  let objectUrl: string | undefined;
  if (typeof createImageBitmap === "function") {
    source = await createImageBitmap(blob);
  } else {
    objectUrl = URL.createObjectURL(blob);
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    source = image;
  }
  try {
    const width = "naturalWidth" in source ? source.naturalWidth : source.width;
    const height = "naturalHeight" in source ? source.naturalHeight : source.height;
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image processing is unavailable in this browser.");
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    if ("close" in source && typeof source.close === "function") source.close();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

async function createOcrWorker(onProgress?: InvoiceOcrProgress) {
  const { createWorker } = await import("tesseract.js");
  return createWorker("eng", undefined, {
    logger: (event) => {
      if (event.status === "recognizing text") {
        onProgress?.(`Reading document locally… ${Math.round(event.progress * 100)}%`);
      }
    },
  });
}

async function scanCanvas(canvas: HTMLCanvasElement, onProgress?: InvoiceOcrProgress): Promise<string> {
  const worker = await createOcrWorker(onProgress);
  try {
    return (await worker.recognize(canvas)).data.text;
  } finally {
    await worker.terminate();
  }
}

async function scanPdf(blob: Blob, onProgress?: InvoiceOcrProgress): Promise<{ text: string; pagesScanned: number; totalPages: number }> {
  const [pdfjs, workerFile] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerFile.default;
  const documentTask = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) });
  const pdf = await documentTask.promise;
  const totalPages = pdf.numPages;
  const pageCount = Math.min(totalPages, MAX_PDF_PAGES);
  try {
    const textPages: string[] = [];
    for (let index = 1; index <= pageCount; index += 1) {
      onProgress?.(`Reading PDF page ${index} of ${pageCount}…`);
      const page = await pdf.getPage(index);
      const content = await page.getTextContent();
      textPages.push(content.items.map((item) => {
        if (!("str" in item)) return "";
        return `${item.str}${"hasEOL" in item && item.hasEOL ? "\n" : " "}`;
      }).join(""));
    }
    const digitalText = textPages.join("\n").trim();
    if (digitalText.length >= 40) {
      return { text: digitalText, pagesScanned: pageCount, totalPages };
    }

    const imagePages: string[] = [];
    const worker = await createOcrWorker(onProgress);
    try {
    for (let index = 1; index <= pageCount; index += 1) {
      onProgress?.(`Preparing PDF page ${index} of ${pageCount} for local OCR…`);
      const page = await pdf.getPage(index);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d");
      if (!context) throw new Error("PDF rendering is unavailable in this browser.");
      await page.render({ canvasContext: context, viewport }).promise;
      imagePages.push((await worker.recognize(canvas)).data.text);
      canvas.width = 0;
      canvas.height = 0;
    }
    } finally {
      await worker.terminate();
    }
    return { text: imagePages.join("\n"), pagesScanned: pageCount, totalPages };
  } finally {
    await pdf.destroy();
  }
}

export async function readInvoiceText(blob: Blob, onProgress?: InvoiceOcrProgress) {
  if (blob.type === "application/pdf") return scanPdf(blob, onProgress);
  onProgress?.("Preparing image for local OCR…");
  const canvas = await imageCanvas(blob);
  return { text: await scanCanvas(canvas, onProgress), pagesScanned: 1, totalPages: 1 };
}

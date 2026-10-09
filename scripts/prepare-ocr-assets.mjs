import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = process.cwd();
const assets = [
  ["node_modules/tesseract.js/dist/worker.min.js", "public/ocr/worker.min.js"],
  ["node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js", "public/ocr/tesseract-core-lstm.wasm.js"],
  ["node_modules/tesseract.js-core/tesseract-core-lstm.wasm", "public/ocr/tesseract-core-lstm.wasm"],
  ["node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz", "public/ocr/lang/eng.traineddata.gz"],
];

for (const [sourcePath, destinationPath] of assets) {
  const destination = resolve(root, destinationPath);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(resolve(root, sourcePath), destination);
}

console.log("Prepared same-origin Tesseract worker, core, and English language data.");

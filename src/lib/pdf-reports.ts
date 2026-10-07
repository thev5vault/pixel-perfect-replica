import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import type { InvestorMetrics, PdfDownload, PublicPassport } from "./v1-types";
import { gbp } from "./plans";

const navy = rgb(.06, .09, .15), cyan = rgb(0, .66, .76), gold = rgb(.67, .52, .25);
const safeText = (text: unknown) => String(text ?? "").normalize("NFKD").replace(/[^\x20-\x7E£\n]/g, "");
async function document(title: string, sample: boolean, logo?: Uint8Array) {
  const pdf = await PDFDocument.create(), font = await pdf.embedFont(StandardFonts.Helvetica), bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logoImage = logo ? (logo[0] === 0x89 ? await pdf.embedPng(logo) : await pdf.embedJpg(logo)) : null;
  let page = pdf.addPage([595, 842]), y = 725;
  function newPage() {
    page.drawRectangle({ x: 22, y: 22, width: 551, height: 798, borderColor: gold, borderWidth: 1 });
    page.drawRectangle({ x: 27, y: 27, width: 541, height: 788, borderColor: cyan, borderWidth: .5 });
    page.drawRectangle({ x: 28, y: 745, width: 539, height: 69, color: navy });
    if (logoImage) page.drawImage(logoImage, { x: 39, y: 750, width: 56, height: 56 });
    page.drawText("V5VAULT", { x: 105, y: 787, font: bold, size: 15, color: rgb(1, 1, 1) });
    page.drawText(safeText(title), { x: 105, y: 765, font, size: 11, color: rgb(.6, .9, .94) });
    page.drawText(sample ? "DEVELOPMENT SAMPLE - NOT LIVE EVIDENCE" : "V5Vault provenance document", { x: 40, y: 43, font, size: 8, color: gold });
    y = 722;
  }
  newPage();
  function line(text: unknown, heading = false) {
    const value = safeText(text), size = heading ? 12 : 10;
    const words = value.split(/\s+/), lines: string[] = []; let buffer = "";
    for (const word of words) {
      if (font.widthOfTextAtSize(`${buffer} ${word}`, size) > 500 && buffer) { lines.push(buffer); buffer = word; }
      else buffer = buffer ? `${buffer} ${word}` : word;
    }
    if (buffer) lines.push(buffer);
    for (const value of lines) {
      if (y < 82) { page = pdf.addPage([595, 842]); newPage(); }
      page.drawText(value.slice(0, 250), { x: 43, y, font: heading ? bold : font, size, color: heading ? cyan : navy });
      y -= heading ? 22 : 16;
    }
    y -= 4;
  }
  return { pdf, line, getPage: () => page, getY: () => y, setY: (value: number) => { y = value; }, font };
}
function base64(bytes: Uint8Array) {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let data = ""; for (const byte of bytes) data += String.fromCharCode(byte); return btoa(data);
}
export async function salesReportPdf(data: PublicPassport, logo?: Uint8Array): Promise<PdfDownload> {
  const doc = await document("Certified Sales Pack", data.is_sample, logo);
  doc.line(`${data.vehicle.make} ${data.vehicle.model} | ${data.vehicle.vrm}`, true);
  doc.line(`Generated: ${new Date(data.generated_at).toLocaleString("en-GB")} | Mileage: ${data.vehicle.odometerAvailable === false ? "Not supplied" : `${data.vehicle.odometer.toLocaleString("en-GB")} miles`}`);
  if (data.vehicle.registrationDate) doc.line(`First registered: ${data.vehicle.registrationDate}`);
  if (data.vehicle.source === "user-provided") doc.line("Vehicle specifications supplied; not verified by a live DVLA/DVSA lookup.");
  doc.line(`VIN: ${data.vehicle.vin ?? "Not supplied"} | Fuel: ${data.vehicle.fuelType ?? "Not returned"} | Colour: ${data.vehicle.colour ?? "Not returned"}`);
  doc.line(`MOT expiry: ${data.vehicle.motExpiry || "Not available"} | Tax: ${data.vehicle.taxStatus ?? "Not available"}`);
  const qr = await QRCode.toDataURL(data.public_url, { width: 220, margin: 3, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
  const image = await doc.pdf.embedPng(qr);
  doc.getPage().drawImage(image, { x: 43, y: doc.getY() - 98, width: 98, height: 98 });
  doc.getPage().drawText("Scan to Verify Authenticity", { x: 154, y: doc.getY() - 40, font: doc.font, size: 11, color: navy });
  doc.getPage().drawText("Read-only vehicle provenance. No keeper details or raw receipts.", { x: 154, y: doc.getY() - 60, font: doc.font, size: 8, color: navy });
  doc.setY(doc.getY() - 120);
  doc.line("SERVICE HISTORY / WORKSHOP PROVENANCE", true);
  for (const service of data.services) {
    doc.line(`${service.date} | ${service.mileage.toLocaleString("en-GB")} mi | ${service.description}`, true);
    doc.line(`${service.garage} | ${service.is_verified_stamp ? (service.stamp_authority === "administrator" ? "Administrator signed" : service.vat_verified ? "VAT-verified workshop stamp" : "Workshop account stamp") : "Owner logged - unverified"}${service.frozen_at ? " | Frozen before keeper change" : ""}`);
    doc.line(service.items.join(" / "));
    if (service.cost !== undefined) doc.line(`Total: ${gbp(Math.round(service.cost * 100))} | Parts: ${gbp(Math.round((service.partsCost ?? 0) * 100))} | Labour: ${gbp(Math.round((service.labourCost ?? 0) * 100))}`);
    for (const part of service.parts ?? []) doc.line(`${part.name} | ${part.partNo}`);
    if (service.fluids) doc.line(`Fluids: ${service.fluids}`);
  }
  if (!data.services.length) doc.line("No service entries recorded.");
  doc.line("MOT / MILEAGE HISTORY", true);
  doc.line("Date | Odometer (miles) | Result");
  for (const mot of data.mot_history) doc.line(`${mot.date} | ${mot.mileage?.toLocaleString("en-GB") ?? "Not recorded"} | ${mot.result}`);
  if (!data.mot_history.length) doc.line("No MOT readings available. No readings have been invented.");
  doc.line("MODIFICATIONS", true);
  for (const mod of data.mods) doc.line(`${mod.installDate} | ${mod.name} | ${mod.status} | ${mod.specs ?? mod.gains}`);
  if (!data.mods.length) doc.line("No modification entries recorded.");
  doc.line("IMPORTANT", true);
  doc.line("This is a V5Vault provenance report, not a government ownership certificate. Owner-logged work is not workshop-verified. The buyer link is controlled by the current keeper. Sample data never establishes live verification.");
  return { filename: `V5Vault-${data.vehicle.vrm}-Sales-Pack.pdf`, base64: base64(await doc.pdf.save()) };
}
export async function investorReportPdf(data: InvestorMetrics, logo?: Uint8Array): Promise<PdfDownload> {
  const doc = await document("Investor & Grant Executive Summary", data.is_sample, logo);
  doc.line("V5Vault - auditable vehicle maintenance provenance", true);
  doc.line("Prepared for investor / Innovate UK assessment. This is not a submitted or approved grant application.");
  doc.line(`As of: ${new Date(data.as_of).toLocaleString("en-GB")}`);
  doc.line(`Registered users: ${data.total_registered_users}`);
  doc.line(`Active vehicle passports: ${data.active_passports}`);
  doc.line(`Approved VAT-verified workshop accounts: ${data.garage_adoption}`);
  doc.line(`Paying subscription accounts: ${data.paying_accounts}`);
  doc.line(`Current recurring monthly equivalent: ${gbp(data.mrr_pence)}`);
  doc.line(`Current-plan monthly projection: ${gbp(data.projected_mrr_pence)}`);
  doc.line(`Pending workshop applications: ${data.pending_workshops}`);
  doc.line("Revenue basis", true);
  doc.line("Recurring revenue uses active Stripe subscriptions at their actual price and billing interval. Annual plans are divided by 12. One-off sales packs and free/admin accounts are excluded. This is subscription MRR, not cash collected, profit or a forecast guarantee.");
  doc.line("Product & safeguards", true);
  doc.line("V5Vault links keeper-reviewed vehicle records to protected V5C references, preserves pre-transfer history, verifies eligible workshop HMAC signatures and lets keepers opt in to read-only buyer sharing. SMS/email reminders require customer consent and verified workshop access.");
  if (data.is_sample) doc.line("All figures in this report are development fixtures and must not be presented as business traction.");
  return { filename: "V5Vault-Investor-Grant-Summary.pdf", base64: base64(await doc.pdf.save()) };
}

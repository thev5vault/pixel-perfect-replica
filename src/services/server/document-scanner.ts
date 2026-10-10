import { z } from "zod";
import { GoogleGenAI, Type } from "@google/genai";

export const scannedServiceDocumentSchema = z.object({
  garageName: z.string().max(160),
  vatNumber: z.string().max(40).optional(),
  date: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
  mileage: z.number().int().min(0).max(2_000_000),
  category: z.enum(["Full Service", "Interim Service", "Major Repair", "MOT", "Modification", "Oil Change"]),
  totalCost: z.number().min(0).max(1_000_000),
  workSummary: z.string().max(2000),
});

export type ScannedServiceDocument = z.infer<typeof scannedServiceDocumentSchema>;

export function canUseAiDocumentScan(user: {
  role?: string | null;
  subscription_tier?: string | null;
  isAdmin?: boolean;
}): boolean {
  return user.isAdmin === true || user.role === "dev_admin" ||
    ["pro_diy", "pro_modder", "verified_workshop", "verified_garage"].includes(user.subscription_tier ?? "");
}

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    garageName: { type: Type.STRING },
    vatNumber: { type: Type.STRING },
    date: { type: Type.STRING, description: "Standardized UK format DD/MM/YYYY" },
    mileage: { type: Type.INTEGER },
    totalCost: { type: Type.NUMBER, description: "Amount in GBP, without currency symbol" },
    category: {
      type: Type.STRING,
      enum: ["Full Service", "Interim Service", "Major Repair", "MOT", "Modification", "Oil Change"],
    },
    workSummary: { type: Type.STRING },
  },
  required: ["garageName", "date", "mileage", "totalCost", "category", "workSummary"],
};

export async function scanServiceDocument(
  file: { bytes: Uint8Array; mimeType: string },
  apiKey = process.env["GEMINI_API_KEY"],
): Promise<ScannedServiceDocument> {
  if (!apiKey) throw new Error("AI document scanning is not configured.");
  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model: "gemini-1.5-flash",
    contents: [{
      role: "user",
      parts: [
        { text: "Read this UK vehicle receipt, invoice or stamped service logbook page. Extract only facts clearly visible; never invent data. Format date as DD/MM/YYYY, monetary values in GBP, use 0 when mileage or total cost is unreadable, and omit vatNumber when no VAT/company number is visible." },
        { inlineData: { mimeType: file.mimeType, data: Buffer.from(file.bytes).toString("base64") } },
      ],
    }],
    config: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema,
    },
  });
  const content = response.text;
  if (!content) throw new Error("Vision service returned no extracted fields.");
  return scannedServiceDocumentSchema.parse(JSON.parse(content));
}

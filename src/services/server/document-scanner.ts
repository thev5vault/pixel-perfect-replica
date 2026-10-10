import { z } from "zod";

export const scannedServiceDocumentSchema = z.object({
  garageName: z.string().max(160),
  vatNumber: z.string().max(40),
  date: z.string().regex(/^\d{2}\/\d{2}\/\d{4}$/),
  mileage: z.number().int().min(0).max(2_000_000),
  category: z.enum(["Full Service", "Interim Service", "Major Repair", "MOT", "Modification", "Oil Change"]),
  totalCost: z.number().min(0).max(1_000_000),
  workSummary: z.string().max(2000),
  confidenceScore: z.enum(["HIGH", "MEDIUM", "LOW"]),
});

export type ScannedServiceDocument = z.infer<typeof scannedServiceDocumentSchema>;

export function canUseAiDocumentScan(user: {
  role?: string | null;
  subscription_tier?: string | null;
}): boolean {
  return user.role === "dev_admin" ||
    ["pro_diy", "pro_modder", "verified_workshop", "verified_garage"].includes(user.subscription_tier ?? "");
}

const responseSchema = {
  type: "object",
  additionalProperties: false,
  required: ["garageName", "vatNumber", "date", "mileage", "category", "totalCost", "workSummary", "confidenceScore"],
  properties: {
    garageName: { type: "string" },
    vatNumber: { type: "string" },
    date: { type: "string", description: "DD/MM/YYYY" },
    mileage: { type: "integer" },
    category: { type: "string", enum: ["Full Service", "Interim Service", "Major Repair", "MOT", "Modification", "Oil Change"] },
    totalCost: { type: "number", description: "GBP total, excluding currency symbols" },
    workSummary: { type: "string" },
    confidenceScore: { type: "string", enum: ["HIGH", "MEDIUM", "LOW"] },
  },
};

export async function scanServiceDocument(
  file: { bytes: Uint8Array; mimeType: string },
  apiKey = process.env["OPENAI_API_KEY"],
): Promise<ScannedServiceDocument> {
  if (!apiKey) throw new Error("AI document scanning is not configured.");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: {
        type: "json_schema",
        json_schema: { name: "v5vault_service_document", strict: true, schema: responseSchema },
      },
      messages: [{
        role: "user",
        content: [
          { type: "text", text: "Extract only visible facts from this UK vehicle service, repair, parts invoice, or stamped logbook image. Return the date as DD/MM/YYYY, cost in GBP, use 0 for unreadable mileage or cost, and LOW confidence when uncertain. Never invent a value." },
          { type: "image_url", image_url: { url: `data:${file.mimeType};base64,${Buffer.from(file.bytes).toString("base64")}`, detail: "high" } },
        ],
      }],
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Vision service returned HTTP ${response.status}.`);
  const payload = await response.json() as { choices?: Array<{ message?: { content?: string | null } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("Vision service returned no extracted fields.");
  return scannedServiceDocumentSchema.parse(JSON.parse(content));
}

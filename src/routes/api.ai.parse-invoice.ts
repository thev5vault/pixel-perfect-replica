import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { currentUser } from "@/services/server/accounts";

const inputSchema = z.object({
  document: z.string().min(1).max(7_000_000)
    .regex(/^data:(?:image\/(?:jpeg|png|webp)|application\/pdf);base64,[A-Za-z0-9+/=\r\n]+$/),
  filename: z.string().max(150).optional(),
});

export const Route = createFileRoute("/api/ai/parse-invoice")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await currentUser();
          if (user.subscription_tier === "free") {
            return Response.json({ error: "Invoice field suggestions are available to paid plan members." }, { status: 403 });
          }
          const parsed = inputSchema.safeParse(await request.json());
          if (!parsed.success) return Response.json({ error: "Upload a valid invoice image or PDF." }, { status: 400 });

          // No vision/OCR provider is connected yet. Do not imply that content
          // was scanned or return fabricated extraction results.
          return Response.json({
            error: "AI invoice scanning is unavailable because no scanning provider is connected. You can still attach the document and enter details manually.",
            manual_entry: true,
            filename: parsed.data.filename,
          }, { status: 503 });
        } catch (error) {
          return Response.json({ error: error instanceof Error ? error.message : "Invoice scan request failed." }, { status: 401 });
        }
      },
    },
  },
});

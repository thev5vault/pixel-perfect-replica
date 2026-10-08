import { createFileRoute } from "@tanstack/react-router";
import { serviceAttachment } from "@/services/server/accounts";

export const Route = createFileRoute("/api/services/$recordId/invoice")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const invoice = await serviceAttachment(params.recordId, "invoice");
          const body = Uint8Array.from(invoice.content).buffer as ArrayBuffer;
          return new Response(body, {
            headers: {
              "Content-Type": invoice.contentType,
              "Content-Disposition": `inline; filename="${invoice.filename}"`,
              "Cache-Control": "private, no-store",
              "X-Content-Type-Options": "nosniff",
              "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
            },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Invoice is unavailable.";
          const status = message === "Sign in to continue." ? 401
            : message.includes("limited") ? 403
              : message.includes("not found") ? 404 : 400;
          return Response.json({ error: message }, { status });
        }
      },
    },
  },
});

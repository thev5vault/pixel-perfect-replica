import { createFileRoute } from "@tanstack/react-router";
import { serviceAttachment } from "@/services/server/accounts";

export const Route = createFileRoute("/api/services/$recordId/receipt")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const receipt = await serviceAttachment(params.recordId, "receipt");
          return new Response(receipt.content, {
            headers: {
              "Content-Type": receipt.contentType,
              "Content-Disposition": `inline; filename="${receipt.filename}"`,
              "Cache-Control": "private, no-store",
              "X-Content-Type-Options": "nosniff",
              "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
            },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Receipt is unavailable.";
          const status = message === "Sign in to continue." ? 401
            : message.includes("limited") ? 403
              : message.includes("not found") ? 404 : 400;
          return Response.json({ error: message }, { status });
        }
      },
    },
  },
});

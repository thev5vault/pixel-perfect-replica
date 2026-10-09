import { createFileRoute } from "@tanstack/react-router";
import { exportAccountData } from "@/services/server/privacy";

export const Route = createFileRoute("/api/user/export")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const data = await exportAccountData(request);
          const date = new Date().toISOString().slice(0, 10);
          return Response.json(data, {
            headers: { "Content-Disposition": `attachment; filename="v5vault-data-${date}.json"` },
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Data export could not be created.";
          return Response.json({ error: message }, { status: /sign in/i.test(message) ? 401 : 500 });
        }
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { checkout } from "@/services/server/billing";

export const Route = createFileRoute("/api/stripe/create-workshop-session")({
  server: {
    handlers: {
      POST: async () => {
        try {
          return Response.json(await checkout({ plan: "workshop_monthly" }));
        } catch (error) {
          const message = error instanceof Error ? error.message : "Workshop checkout could not be started.";
          const status = message === "Sign in to continue." ? 401 : message.includes("required") ? 403 : 400;
          return Response.json({ error: message }, { status });
        }
      },
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { handleCheckoutPost } from "@/services/server/checkout-http";

export const Route = createFileRoute("/api/create-checkout-session")({
  server: {
    handlers: {
      POST: async ({ request }) => handleCheckoutPost(request),
    },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { checkout } from "@/services/server/billing";

const inputSchema = z.object({
  plan: z.enum(["sales_pack", "diy_monthly", "pro_monthly", "pro_yearly", "workshop_monthly"]),
  vrm: z.string().trim().max(12).optional(),
});

export const Route = createFileRoute("/api/stripe/create-checkout-session")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const parsed = inputSchema.safeParse(await request.json());
          if (!parsed.success) return Response.json({ error: "Choose a supported V5Vault plan." }, { status: 400 });
          return Response.json(await checkout(parsed.data));
        } catch (error) {
          const message = error instanceof Error ? error.message : "Checkout could not be started.";
          const status = message === "Sign in to continue." ? 401 : message.includes("required") ? 403 : 400;
          return Response.json({ error: message }, { status });
        }
      },
    },
  },
});

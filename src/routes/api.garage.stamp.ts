import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { stampServiceByVIN } from "@/services/server/vehicle-identity";

const stampInput = z.object({
  vrm: z.string().trim().min(2).max(12).regex(/^[A-Za-z0-9 ]+$/),
  vin: z.string().trim().length(17).regex(/^[A-HJ-NPR-Z0-9]{17}$/i),
  physically_inspected_vin: z.literal(true),
  mileage: z.number().int().min(0).max(2_000_000),
  notes: z.string().trim().min(1).max(1000),
});

export const Route = createFileRoute("/api/garage/stamp")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          return Response.json({ record: await stampServiceByVIN(stampInput.parse(await request.json())) }, { status: 201 });
        } catch (error) {
          const message = error instanceof Error ? error.message : "The service record could not be saved.";
          const status = message === "Sign in to continue." ? 401 : message.includes("required") ? 403 : 400;
          return Response.json({ error: message }, { status });
        }
      },
    },
  },
});

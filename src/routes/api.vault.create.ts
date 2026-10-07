import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createVehicleByVIN } from "@/services/server/vehicle-identity";

const createInput = z.object({
  vrm: z.string().trim().min(2).max(12).regex(/^[A-Za-z0-9 ]+$/),
  vin: z.string().trim().length(17).regex(/^[A-HJ-NPR-Z0-9]{17}$/i),
  make: z.string().trim().min(1).max(80),
  model: z.string().trim().min(1).max(120),
  year: z.number().int().min(1886).max(new Date().getUTCFullYear() + 1),
  odometer: z.number().int().min(0).max(2_000_000),
  motExpiry: z.string().date(),
});

export const Route = createFileRoute("/api/vault/create")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const result = await createVehicleByVIN(createInput.parse(await request.json()));
          return Response.json(result, { status: 201 });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Vehicle could not be saved.";
          const status = message === "Sign in to continue." ? 401 : message.startsWith("Verify ") ? 403 : 400;
          return Response.json({ error: message }, { status });
        }
      },
    },
  },
});

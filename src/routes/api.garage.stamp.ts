import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { stampServiceByVIN } from "@/services/server/vehicle-identity";

const stampInput = z.object({
  vrm: z.string().trim().min(2).max(12).regex(/^[A-Za-z0-9 ]+$/),
  vin: z.string().trim().length(17).regex(/^[A-HJ-NPR-Z0-9]{17}$/i),
  physically_inspected_vin: z.literal(true),
  mileage: z.number().int().min(0).max(2_000_000),
  notes: z.string().trim().max(2000),
  date: z.string().date().optional(),
  category: z.enum(["Servicing","Brakes","Repairs","Tyres"]).optional(),
  components: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
  advisories: z.array(z.string().trim().min(1).max(500)).max(30).optional(),
  cost: z.number().min(0).max(1_000_000).optional(),
  partsCost: z.number().min(0).max(1_000_000).optional(),
  labourCost: z.number().min(0).max(1_000_000).optional(),
  image: z.string().max(4_000_000).regex(/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=\r\n]+$/).optional(),
  invoice_name: z.string().max(200).optional(),
  invoice_data: z.string().max(7_000_000).regex(/^data:application\/pdf;base64,[A-Za-z0-9+/=\r\n]+$/).optional(),
}).refine((value) => Boolean(value.notes || value.components?.length), {
  message: "Add work notes or select at least one component.",
  path: ["notes"],
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

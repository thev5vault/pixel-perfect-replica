import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { mockVehicleLookup } from "@/services/server/vehicle-identity";

export const Route = createFileRoute("/api/garage/lookup")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const body = z.object({ vrm: z.string().trim().min(2).max(12).regex(/^[A-Za-z0-9 ]+$/) }).parse(await request.json());
          return Response.json(await mockVehicleLookup(body.vrm, request, true));
        } catch (error) {
          const message = error instanceof Error ? error.message : "Sample lookup failed.";
          const status = error && typeof error === "object" && "status" in error && error.status === 429
            ? 429
            : message === "Sign in to continue." ? 401 : 400;
          return Response.json({ error: message }, { status });
        }
      },
    },
  },
});

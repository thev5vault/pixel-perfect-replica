import { createFileRoute } from "@tanstack/react-router";
import { mockVehicleLookup } from "@/services/server/vehicle-identity";

export const Route = createFileRoute("/api/vehicle/lookup")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const vrm = new URL(request.url).searchParams.get("vrm")?.trim();
          if (!vrm || vrm.length > 12 || !/^[A-Za-z0-9 ]+$/.test(vrm)) {
            return Response.json({ error: "Enter a valid vehicle registration." }, { status: 400 });
          }
          return Response.json(await mockVehicleLookup(vrm));
        } catch (error) {
          const message = error instanceof Error ? error.message : "Vehicle lookup failed.";
          const status = message === "Sign in to continue." ? 401 : /not found/i.test(message) ? 404 : 503;
          return Response.json({ error: message }, { status });
        }
      },
    },
  },
});

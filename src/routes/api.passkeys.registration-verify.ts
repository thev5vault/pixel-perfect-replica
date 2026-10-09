import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { currentUser } from "@/services/server/accounts";
import { verifyRegistration, webAuthnErrorResponse, webAuthnJsonResponse } from "@/services/server/webauthn";

const inputSchema = z.object({
  challengeId: z.string().uuid(),
  response: z.unknown(),
});

export const Route = createFileRoute("/api/passkeys/registration-verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await currentUser(request);
          const input = inputSchema.parse(await request.json());
          return webAuthnJsonResponse(await verifyRegistration(request, user, input.challengeId, input.response));
        } catch (error) {
          return webAuthnErrorResponse(error);
        }
      },
    },
  },
});

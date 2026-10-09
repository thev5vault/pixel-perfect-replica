import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { verifyAuthentication, webAuthnErrorResponse, webAuthnJsonResponse } from "@/services/server/webauthn";

const inputSchema = z.object({
  challengeId: z.string().uuid(),
  response: z.unknown(),
});

export const Route = createFileRoute("/api/passkeys/authentication-verify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const input = inputSchema.parse(await request.json());
          const result = await verifyAuthentication(request, input.challengeId, input.response);
          return webAuthnJsonResponse({ verified: result.verified }, { headers: { "Set-Cookie": result.cookie } });
        } catch (error) {
          return webAuthnErrorResponse(error);
        }
      },
    },
  },
});

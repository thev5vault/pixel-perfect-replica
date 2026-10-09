import { createFileRoute } from "@tanstack/react-router";
import { createAuthenticationOptions, webAuthnErrorResponse, webAuthnJsonResponse } from "@/services/server/webauthn";

export const Route = createFileRoute("/api/passkeys/authentication-options")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          return webAuthnJsonResponse(await createAuthenticationOptions(request));
        } catch (error) {
          return webAuthnErrorResponse(error);
        }
      },
    },
  },
});

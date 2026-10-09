import { createFileRoute } from "@tanstack/react-router";
import { currentUser } from "@/services/server/accounts";
import { createRegistrationOptions, webAuthnErrorResponse, webAuthnJsonResponse } from "@/services/server/webauthn";

export const Route = createFileRoute("/api/passkeys/registration-options")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const user = await currentUser(request);
          return webAuthnJsonResponse(await createRegistrationOptions(request, user));
        } catch (error) {
          return webAuthnErrorResponse(error);
        }
      },
    },
  },
});

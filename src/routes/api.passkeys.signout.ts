import { createFileRoute } from "@tanstack/react-router";
import { revokePasskeySession, webAuthnErrorResponse, webAuthnJsonResponse } from "@/services/server/webauthn";

export const Route = createFileRoute("/api/passkeys/signout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const cookie = await revokePasskeySession(request);
          return webAuthnJsonResponse({ signedOut: true }, { headers: { "Set-Cookie": cookie } });
        } catch (error) {
          return webAuthnErrorResponse(error);
        }
      },
    },
  },
});

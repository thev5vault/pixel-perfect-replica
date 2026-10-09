import { createFileRoute } from "@tanstack/react-router";
import { currentUser } from "@/services/server/accounts";
import { getPasskeyCount, webAuthnErrorResponse, webAuthnJsonResponse } from "@/services/server/webauthn";

export const Route = createFileRoute("/api/passkeys/count")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const user = await currentUser(request);
          return webAuthnJsonResponse({ count: await getPasskeyCount(user.id) });
        } catch (error) {
          return webAuthnErrorResponse(error);
        }
      },
    },
  },
});

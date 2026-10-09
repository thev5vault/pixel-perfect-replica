import { createFileRoute } from "@tanstack/react-router";
import { WebAuthnError, webAuthnRequestContext } from "@/services/server/webauthn";
import { deleteAccount } from "@/services/server/privacy";

export const Route = createFileRoute("/api/user/account")({
  server: {
    handlers: {
      DELETE: async ({ request }) => {
        try {
          webAuthnRequestContext(request);
          const body: unknown = await request.json();
          const confirmation = body && typeof body === "object" && "confirmation" in body
            ? String(body.confirmation) : "";
          const result = await deleteAccount(request, confirmation);
          return Response.json({ ok: true }, { headers: { "Set-Cookie": result.passkeyCookie } });
        } catch (error) {
          const message = error instanceof Error ? error.message : "Account deletion could not be completed.";
          const status = error instanceof WebAuthnError ? error.status : /sign in/i.test(message) ? 401 : /type DELETE/i.test(message) ? 400 : 500;
          return Response.json({ error: message }, { status });
        }
      },
    },
  },
});

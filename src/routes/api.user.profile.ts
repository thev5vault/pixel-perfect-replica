import { createFileRoute } from "@tanstack/react-router";
import { accountProfileInputSchema, WorkshopProfileAccessError } from "@/lib/account-profile";
import { updateAccount } from "@/services/server/accounts";
import { webAuthnRequestContext, WebAuthnError } from "@/services/server/webauthn";

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : "Profile could not be saved.";
  const status = error instanceof WebAuthnError
    ? error.status
    : error instanceof WorkshopProfileAccessError
      ? 403
    : /sign in to continue/i.test(message)
      ? 401
      : 500;
  return Response.json({ error: message }, { status });
}

export const Route = createFileRoute("/api/user/profile")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          webAuthnRequestContext(request);
          const body: unknown = await request.json();
          const input = accountProfileInputSchema.safeParse(body);
          if (!input.success) {
            return Response.json({ error: "Profile details are invalid.", issues: input.error.flatten() }, { status: 400 });
          }
          return Response.json(await updateAccount(input.data, request));
        } catch (error) {
          return errorResponse(error);
        }
      },
    },
  },
});

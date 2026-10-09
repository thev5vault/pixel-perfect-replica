import { z } from "zod";
import { checkout } from "./billing";

const checkoutInput = z.object({
  plan: z.enum(["sales_pack", "diy_monthly", "diy_yearly", "pro_monthly", "pro_yearly", "workshop_monthly", "workshop_yearly"]),
  vrm: z.string().trim().max(12).optional(),
  billingInterval: z.enum(["month", "year"]).optional(),
  returnUrl: z.string().trim().max(2048).optional(),
});

export async function handleCheckoutPost(request: Request) {
  try {
    const parsed = checkoutInput.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Choose a supported V5Vault plan." }, { status: 400 });
    return Response.json(await checkout(parsed.data));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Checkout could not be started.";
    const status = message === "Sign in to continue." ? 401
      : /required|SuperAdmin/i.test(message) ? 403 : 400;
    return Response.json({ error: message }, { status });
  }
}

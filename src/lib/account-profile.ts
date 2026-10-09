import { z } from "zod";

const tradeProfileFields = ["garage_name", "garage_registration", "workshop_type"] as const;

export const accountProfileInputSchema = z.object({
  full_name: z.string().trim().min(1).max(100),
  garage_name: z.string().trim().max(100).optional(),
  garage_registration: z.string().trim().max(40).optional(),
  workshop_type: z.enum(["garage", "specialist"]).optional(),
}).strict().superRefine((value, context) => {
  const hasTradeDetails = tradeProfileFields.some((field) => value[field] !== undefined);
  if (hasTradeDetails && tradeProfileFields.some((field) => value[field] === undefined)) {
    context.addIssue({
      code: "custom",
      path: ["garage_name"],
      message: "Workshop details must be submitted together.",
    });
  }
});

export type AccountProfileInput = z.infer<typeof accountProfileInputSchema>;

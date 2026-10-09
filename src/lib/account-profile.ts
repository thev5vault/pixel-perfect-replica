import { z } from "zod";
import type { UserAccount } from "./account-types";

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

export type AccountProfileInput = {
  full_name: string;
  garage_name?: string | undefined;
  garage_registration?: string | undefined;
  workshop_type?: "garage" | "specialist" | undefined;
};

export function mergeAccountProfile(user: UserAccount, profile: AccountProfileInput): UserAccount {
  return {
    ...user,
    full_name: profile.full_name,
    ...(profile.garage_name !== undefined ? { garage_name: profile.garage_name } : {}),
    ...(profile.garage_registration !== undefined ? { garage_registration: profile.garage_registration } : {}),
    ...(profile.workshop_type !== undefined ? { workshop_type: profile.workshop_type } : {}),
  };
}

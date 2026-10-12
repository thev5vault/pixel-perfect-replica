import { z } from "zod";
import type { UserAccount } from "./account-types";
import { isWorkshopTrialActive } from "./plans";

const tradeProfileFields = ["garage_name", "garage_registration", "workshop_type"] as const;

export const accountProfileInputSchema = z.object({
  full_name: z.string().trim().min(1).max(100),
  display_preference: z.enum(["easy", "detailed"]).optional(),
  garage_name: z.string().trim().max(100).optional(),
  garage_registration: z.string().trim().max(40).optional(),
  workshop_type: z.enum(["garage", "specialist"]).optional(),
  garage_logo_url: z.string().trim().max(2048).optional(),
  imi_accreditation: z.string().trim().max(100).optional(),
  garage_address: z.string().trim().max(500).optional(),
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
  display_preference?: "easy" | "detailed" | undefined;
  garage_name?: string | undefined;
  garage_registration?: string | undefined;
  workshop_type?: "garage" | "specialist" | undefined;
  garage_logo_url?: string | undefined;
  imi_accreditation?: string | undefined;
  garage_address?: string | undefined;
};

export function mergeAccountProfile(user: UserAccount, profile: AccountProfileInput): UserAccount {
  return {
    ...user,
    full_name: profile.full_name,
    ...(profile.display_preference !== undefined ? { display_preference: profile.display_preference } : {}),
    ...(profile.garage_name !== undefined ? { garage_name: profile.garage_name } : {}),
    ...(profile.garage_registration !== undefined ? { garage_registration: profile.garage_registration } : {}),
    ...(profile.workshop_type !== undefined ? { workshop_type: profile.workshop_type } : {}),
    ...(profile.garage_logo_url !== undefined ? { garage_logo_url: profile.garage_logo_url } : {}),
    ...(profile.imi_accreditation !== undefined ? { imi_accreditation: profile.imi_accreditation } : {}),
    ...(profile.garage_address !== undefined ? { garage_address: profile.garage_address } : {}),
  };
}

type WorkshopProfileActor = Pick<
  UserAccount,
  "role" | "subscription_tier" | "subscription_status" | "trial_expires_at" | "permissions"
>;

/** Profile writes cannot grant workshop entitlement; only an active paid plan, trial, or admin override may edit trade details. */
export function canEditWorkshopProfile(user: WorkshopProfileActor, now = Date.now()) {
  if (user.role === "dev_admin" && user.permissions?.includes("all_access")) return true;
  if (user.role !== "verified_garage") return false;
  return (user.subscription_tier === "verified_garage" && user.subscription_status === "active")
    || isWorkshopTrialActive(user, now);
}

export class WorkshopProfileAccessError extends Error {
  constructor() {
    super("An active Verified Workshop subscription or trial is required to update trade details.");
    this.name = "WorkshopProfileAccessError";
  }
}

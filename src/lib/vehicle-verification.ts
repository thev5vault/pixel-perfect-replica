export const VEHICLE_VERIFICATION_STATES = [
  "PENDING_VERIFICATION",
  "VERIFIED",
  "RE_VERIFICATION_REQUIRED",
] as const;

export type VehicleVerificationState = (typeof VEHICLE_VERIFICATION_STATES)[number];

export const REVERIFICATION_NOTICE =
  "Logbook or Plate Updated: Please enter your new VRM and 11-digit V5C reference number to re-verify ownership and unlock live export features.";

export function hasVerifiedVehicleRegistration(
  state: VehicleVerificationState | string | null | undefined,
): boolean {
  return state === "VERIFIED";
}

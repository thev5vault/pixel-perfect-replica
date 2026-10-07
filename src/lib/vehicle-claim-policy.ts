export const LG57_VYF = "LG57VYF";
export const LG57_VYF_VIN = "WUAZZZ8EX8A800721";

export function normalizeRegistration(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function vehicleClaimPolicy(vrm: string, environment: string | undefined) {
  return normalizeRegistration(vrm) === LG57_VYF && environment !== "production"
    ? "first_account" as const
    : "v5c_review" as const;
}

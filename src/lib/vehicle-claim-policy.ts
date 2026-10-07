export const LG57_VYF = "LG57VYF";
export const LG57_VYF_VIN = "WUAZZZ8EX8A800721";
export const DEVELOPMENT_CLAIM_REFERENCE = "62396755471";
const DEVELOPMENT_FIXTURES = new Set(["LG57VYF", "AB14CDE", "BUL200"]);

export function normalizeRegistration(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function isDevelopmentFixtureVrm(vrm: string) {
  return DEVELOPMENT_FIXTURES.has(normalizeRegistration(vrm));
}

export function resolveClaimReference(vrm: string, reference: string | undefined, environment: string | undefined) {
  const supplied = reference?.trim() ?? "";
  if (supplied) return supplied;
  return environment !== "production" && isDevelopmentFixtureVrm(vrm)
    ? DEVELOPMENT_CLAIM_REFERENCE
    : "";
}

export function vehicleClaimPolicy(vrm: string, environment: string | undefined) {
  return normalizeRegistration(vrm) === LG57_VYF && environment !== "production"
    ? "first_account" as const
    : "v5c_review" as const;
}

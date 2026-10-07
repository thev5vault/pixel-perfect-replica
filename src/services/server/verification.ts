import { createHmac, timingSafeEqual } from "node:crypto";

export function sampleApproval(development: boolean, isSample: boolean, status: string) {
  return development && isSample && status === "approved";
}
export function referenceAction(previouslyUsed:boolean,currentOwner:boolean,currentReference:boolean):"unchanged"|"reject"|"consume" {
  if(currentOwner && currentReference) return "unchanged";
  return previouslyUsed ? "reject" : "consume";
}
export function mayStamp(input: { role: string; verified: boolean; status: string; garageSample: boolean; vehicleSample: boolean; development: boolean }) {
  return input.role === "verified_garage" && input.verified && input.status === "approved"
    && (!input.garageSample || (input.development && input.vehicleSample))
    && (!input.vehicleSample || input.development);
}
export function signStamp(id: string, garageId: string, data: unknown, sample: boolean, secret: string) {
  // JSONB reorders object keys. Sign a canonical representation, never insertion order.
  return `v1.${sample ? "sample" : "live"}.${createHmac("sha256", secret).update(JSON.stringify([id,garageId,canonical(data)])).digest("hex")}`;
}
function canonical(value:unknown):unknown {
  if(Array.isArray(value)) return value.map(canonical);
  if(value && typeof value==="object") return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,canonical(item)]));
  return value;
}
export function checkStamp(id: string, garageId: string, data: unknown, sample: boolean, signature: string, secret: string) {
  const expected = Buffer.from(signStamp(id,garageId,data,sample,secret));
  const actual = Buffer.from(signature);
  return expected.length === actual.length && timingSafeEqual(expected,actual);
}

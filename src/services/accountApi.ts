import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { AccountProfileInput } from "@/lib/account-profile";

const vrm = z.string().min(2).max(12).regex(/^[A-Za-z0-9 ]+$/);
const service = z.object({
  vrm, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), mileage: z.number().int().min(0).max(2000000),
  category: z.enum(["Servicing","Brakes","Repairs","Tyres"]), description: z.string().min(1).max(160),
  items: z.array(z.string().max(1000)).max(30), garage: z.string().max(100),
  components: z.array(z.string().trim().min(1).max(100)).max(50).optional(),
  work_performed: z.string().max(2000).optional(),
  advisories: z.array(z.string().trim().min(1).max(500)).max(30).optional(),
  currency: z.literal("GBP").optional(),
  cost: z.number().min(0).max(1000000).optional(), image: z.string().max(4000000).optional(),
  parts: z.array(z.object({name:z.string().max(150),partNo:z.string().max(150)})).max(50).optional(),
  fluids: z.string().max(1000).optional(), partsCost:z.number().min(0).optional(), labourCost:z.number().min(0).optional(),
  invoice_name: z.string().max(200).optional(), invoice_data: z.string().max(7000000).regex(/^data:application\/pdf;base64,[A-Za-z0-9+/=\r\n]+$/).optional(),
  next_service_due:z.string().date().optional(),
});
export const getAccountState = createServerFn({method:"GET"}).handler(async () => (await import("./server/accounts")).accountState());
export const claimVehicleInputSchema = z.object({
  vrm,
  reference: z.string().regex(/^(?:\d{11})?$/).optional().default(""),
  vin: z.string().trim().length(17).regex(/^[A-HJ-NPR-Z0-9]{17}$/i).optional(),
});
export const claimVehicle = createServerFn({method:"POST"})
  .validator(claimVehicleInputSchema)
  .handler(async ({data}) => (await import("./server/accounts")).claim(data));
export const switchDevelopmentRole = createServerFn({method:"POST"})
  .validator(z.object({role:z.enum(["Owner","DIY","Pro","Garage","superadmin"])}))
  .handler(async ({data}) => (await import("./server/accounts")).developmentRole(data.role));
export async function saveAccount(input: AccountProfileInput) {
  const response = await fetch("/api/user/profile", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const result = await response.json() as { error?: string; ok?: boolean };
  if (!response.ok) throw new Error(result.error || "Profile could not be saved.");
  return result;
}
export const createServiceRecord = createServerFn({method:"POST"}).validator(service)
  .handler(async ({data}) => (await import("./server/accounts")).createService(data));
export const markNotificationsRead = createServerFn({method:"POST"}).handler(async () => (await import("./server/accounts")).markRead());
export const createBooking = createServerFn({method:"POST"})
  .validator(z.object({vrm,date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),notes:z.string().max(1000)}))
  .handler(async ({data}) => (await import("./server/accounts")).book(data));
export const updateBooking = createServerFn({method:"POST"})
  .validator(z.object({id:z.string(),status:z.enum(["completed","cancelled"])}))
  .handler(async ({data}) => (await import("./server/accounts")).bookingStatus(data.id,data.status));
export const saveModification = createServerFn({method:"POST"})
  .validator(z.object({vrm,name:z.string().min(1).max(160),category:z.enum(["Engine/ECU","Exhaust","Intake","Suspension","Brakes","Visual"]),installDate:z.string(),installMileage:z.number().int().min(0),gains:z.string().max(200),notes:z.string().max(2000),image:z.string().max(4000000).optional(),stage:z.string().optional(),specs:z.string().optional(),tags:z.array(z.string()).optional()}))
  .handler(async ({data}) => (await import("./server/accounts")).addModification(data));
export const revertModification = createServerFn({method:"POST"})
  .validator(z.object({id:z.string(),date:z.string(),mileage:z.number().int().min(0)}))
  .handler(async ({data}) => (await import("./server/accounts")).revertModification(data));
export const verifyWorkshopStamp = createServerFn({method:"GET"}).validator(z.object({id:z.string().max(100)}))
  .handler(async ({data}) => (await import("./server/accounts")).verifyStamp(data.id));
export const getAdminState = createServerFn({method:"GET"})
  .handler(async () => (await import("./server/accounts")).adminState());
export const reviewWorkshop = createServerFn({method:"POST"})
  .validator(z.object({id:z.string().min(1).max(100),status:z.enum(["approved","rejected"]),vat_verified:z.boolean().optional()}))
  .handler(async ({data}) => (await import("./server/accounts")).reviewWorkshop(data));
export const editAdminVehicle = createServerFn({method:"POST"})
  .validator(z.object({vrm,make:z.string().trim().min(1).max(100),model:z.string().trim().min(1).max(150),odometer:z.number().int().min(0).max(2000000),is_scrapped:z.boolean().optional()}))
  .handler(async ({data}) => (await import("./server/accounts")).editAdminVehicle(data));
export const grantTierOverride = createServerFn({method:"POST"})
  .validator(z.object({id:z.string().trim().min(1).max(100)}))
  .handler(async ({data}) => (await import("./server/accounts")).grantTierOverride(data.id));
export const revokeTierOverride = createServerFn({method:"POST"})
  .validator(z.object({id:z.string().trim().min(1).max(100)}))
  .handler(async ({data}) => (await import("./server/accounts")).revokeTierOverride(data.id));
export const extendWorkshopTrial = createServerFn({method:"POST"})
  .validator(z.object({id:z.string().trim().min(1).max(100)}))
  .handler(async ({data}) => (await import("./server/accounts")).extendWorkshopTrial(data.id));

import { ADMIN_PERMISSIONS, type AccountState, type AdminUser } from "./account-types";
import receiptService from "@/assets/receipt-service.jpg";
import receiptBrakes from "@/assets/receipt-brakes.jpg";
import dynoSheet from "@/assets/dyno-sheet.jpg";

export const SAMPLE_PREVIEW_KEY = "v5vault:sample-preview";
let inMemoryPreview = false;
export function previewEnabled() {
  if (!import.meta.env.DEV) return false;
  if (inMemoryPreview) return true;
  try { return sessionStorage.getItem(SAMPLE_PREVIEW_KEY) === "1"; } catch { return false; }
}
export function setPreviewEnabled(enabled: boolean) {
  inMemoryPreview = enabled && import.meta.env.DEV;
  try {
    if (enabled && import.meta.env.DEV) sessionStorage.setItem(SAMPLE_PREVIEW_KEY, "1");
    else sessionStorage.removeItem(SAMPLE_PREVIEW_KEY);
  } catch { /* Preview remains usable in memory when private storage is denied. */ }
}
export function sampleAccount(): AccountState {
  return {
    user: {
      id: "sample-admin", email: "admin@sample.v5vault.invalid", full_name: "Kieran Admin (sample)",
      role: "dev_admin", subscription_tier: "god_mode", permissions: [...ADMIN_PERMISSIONS],
      stripe_customer_id: null, created_at: "2026-01-01T00:00:00Z", garage_verified: true,
      garage_name: "Sample Workshop", garage_registration: "SAMPLE-ONLY",
      workshop_type: "garage", status: "approved", is_sample: true,
    },
    development: true, development_role: "superadmin", notifications: [], bookings: [],
    vehicles: [
      { vrm: "AB14CDE", make: "Audi", model: "A4 2.0 TDI", odometer: 87420,
        v5cDate: "2019-03-15", motExpiry: "2026-11-18", year: 2014, fuelType: "Diesel",
        owner_user_id: "sample-admin", status: "approved", is_sample: true, source: "demo",
        motHistory: [{date:"2023-11-15",mileage:80480,result:"Pass"},{date:"2025-11-18",mileage:86900,result:"Pass"}] },
      { vrm: "ZX19XYZ", make: "Ford", model: "Focus", odometer: 42180,
        v5cDate: "2021-02-10", motExpiry: "2026-12-01", year: 2019, fuelType: "Petrol",
        owner_user_id: "sample-driver", status: "approved", is_sample: true, source: "demo" },
    ],
    services: [
      {id:"preview-service",vrm:"AB14CDE",date:"2024-09-12",mileage:82100,category:"Servicing",
        description:"Full Service",items:["Engine oil","Oil filter","Labour"],garage:"Sample Workshop",
        cost:289,partsCost:154,labourCost:135,fluids:"5W-30 LL · VW 504.00/507.00 · 4.6L",
        parts:[{name:"Oil filter",partNo:"Bosch F 026 407 183"},{name:"Air filter",partNo:"Mann C 30 005"}],
        image:receiptService,has_receipt:true,verified:false,is_sample:true,status:"approved"},
      {id:"preview-brakes",vrm:"AB14CDE",date:"2025-03-08",mileage:85340,category:"Brakes",
        description:"Front Brake Replacement",items:["Front discs","Front pads","Labour"],garage:"Sample Workshop",
        cost:642,partsCost:468,labourCost:174,parts:[{name:"Front discs",partNo:"Brembo 09.C401.13"}],
        image:receiptBrakes,has_receipt:true,verified:false,is_sample:true,status:"approved"},
    ],
    mods: [{id:"preview-remap",vrm:"AB14CDE",name:"Stage 2 ECU Remap",category:"Engine/ECU",
      installDate:"2024-11-02",installMileage:83650,gains:"+53 bhp / +80 Nm",
      notes:"Sample modification, not live vehicle data.",image:dynoSheet,status:"active"}],
  };
}
export function sampleUsers(account: AccountState): AdminUser[] {
  return [
    account.user,
    {...account.user,id:"sample-driver",email:"driver@sample.v5vault.invalid",full_name:"Sample Driver",role:"civilian",subscription_tier:"free",garage_name:"",garage_registration:"",garage_verified:false},
    {...account.user,id:"sample-garage",email:"garage@sample.v5vault.invalid",full_name:"Sample Garage Applicant",role:"civilian",subscription_tier:"free",garage_name:"Sample Motor Works",garage_registration:"SAMPLE-GARAGE",garage_verified:false,status:"pending"},
    {...account.user,id:"sample-specialist",email:"specialist@sample.v5vault.invalid",full_name:"Sample Specialist Applicant",role:"civilian",subscription_tier:"free",garage_name:"Sample Tuning Specialist",garage_registration:"SAMPLE-SPECIALIST",garage_verified:false,status:"pending",workshop_type:"specialist"},
  ];
}

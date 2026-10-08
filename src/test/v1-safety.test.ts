// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type Stripe from "stripe";
import { passportData } from "@/lib/passport-data";
import { salesReportPdf } from "@/lib/pdf-reports";
import { vehicleLimit, PLAN_DEFINITIONS, planForBillingInterval } from "@/lib/plans";
import { sampleAccount } from "@/lib/sample-account";
const query=vi.hoisted(()=>vi.fn());
vi.mock("@/services/server/db",()=>({pool:{query}}));
import { fulfillSalesPack } from "@/services/server/sales-fulfillment";
const paid=(overrides:Partial<Stripe.Checkout.Session>={})=>({
  id:"cs_test_known",client_reference_id:"purchaser",mode:"payment",status:"complete",payment_status:"paid",currency:"gbp",amount_total:299,
  metadata:{app:"v5vault",plan_key:"sales_pack",order_id:"known-order",user_id:"purchaser"},...overrides,
} as Stripe.Checkout.Session);
beforeEach(()=>{query.mockReset();query.mockResolvedValue({rowCount:1});});
describe("V1 billing and private document boundaries",()=>{
  it("keeps the specified GBP plan amounts",()=>{
    expect(PLAN_DEFINITIONS.sales_pack.amount).toBe(299);
    expect(PLAN_DEFINITIONS.pro_monthly.amount).toBe(149);
    expect(PLAN_DEFINITIONS.pro_yearly.amount).toBe(1499);
    expect(PLAN_DEFINITIONS.diy_monthly.amount).toBe(99);
    expect(PLAN_DEFINITIONS.diy_yearly.amount).toBe(999);
    expect(PLAN_DEFINITIONS.workshop_monthly.amount).toBe(999);
    expect(PLAN_DEFINITIONS.workshop_yearly.amount).toBe(9999);
    expect(planForBillingInterval("diy_monthly", "year")).toBe("diy_yearly");
    expect(planForBillingInterval("pro_yearly", "month")).toBe("pro_monthly");
    expect(planForBillingInterval("workshop_monthly", "year")).toBe("workshop_yearly");
  });
  it("limits Free to one vehicle and Collector to three, without restricting administrators",()=>{
    const user=sampleAccount().user;
    expect(vehicleLimit({...user,role:"civilian",subscription_tier:"free"})).toBe(1);
    expect(vehicleLimit({...user,role:"civilian",subscription_tier:"pro_modder"})).toBe(3);
    expect(vehicleLimit({...user,role:"dev_admin"})).toBe(Infinity);
  });
  it.each([
    {payment_status:"unpaid"},{status:"open"},{amount_total:0},{amount_total:499},{currency:"usd"},
    {mode:"subscription"},{client_reference_id:"another-user"},{metadata:{app:"other-app"}},
  ] as Partial<Stripe.Checkout.Session>[])("does not fulfill an unpaid, mismatched or unrelated checkout: %j",async override=>{
    expect(await fulfillSalesPack(paid(override))).toBe(false);
    expect(query).not.toHaveBeenCalled();
  });
  it("fulfills only an existing order bound to the verified session and purchaser",async()=>{
    expect(await fulfillSalesPack(paid())).toBe(true);
    expect(query.mock.calls[0]?.[1]).toEqual(["known-order","purchaser","cs_test_known"]);
    query.mockResolvedValueOnce({rowCount:0});
    expect(await fulfillSalesPack(paid())).toBe(false);
  });
  it("excludes keeper details, full VIN, invoices, photos and private mod notes",()=>{
    const state=sampleAccount(),vehicle={...state.vehicles[0]!,vin:"WVWZZZ8EZ6A123456",owner_user_id:"private-keeper"};
    const services=state.services.map(s=>({...s,image:"private-image",invoice_data:"private-pdf"}));
    const mods=state.mods.map(m=>({...m,notes:"private-mod-notes",dynoImage:"private-dyno"}));
    const data=passportData(vehicle,services,mods,"https://example.test",true);
    const json=JSON.stringify(data);
    for(const secret of ["private-keeper",vehicle.vin,"private-image","private-pdf","private-mod-notes","private-dyno"])expect(json).not.toContain(secret);
    expect(data.verified_stamp_count).toBe(0);
  });
  it("redacts exact OEM numbers and itemized costs on unpaid public previews",()=>{
    const state=sampleAccount();
    const data=passportData(state.vehicles[0]!,state.services,state.mods,"https://example.test",true,false);
    for(const service of data.services){expect(service.parts).toBeUndefined();expect(service.fluids).toBeUndefined();expect(service.partsCost).toBeUndefined();}
  });
  it("generates a real multi-page-capable PDF with a verification QR",async()=>{
    const state=sampleAccount(),data=passportData(state.vehicles[0]!,state.services,state.mods,"https://example.test",true);
    const pdf=await salesReportPdf(data);
    expect(Buffer.from(pdf.base64,"base64").subarray(0,4).toString()).toBe("%PDF");
  });
});

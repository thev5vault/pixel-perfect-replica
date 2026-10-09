import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { applyAdminPolicy } from "@/services/server/admin-policy";
import { ADMIN_PERMISSIONS } from "@/lib/account-types";
import { sampleAccount } from "@/lib/sample-account";
import { accountHome, isAuthEntry } from "@/lib/auth-routing";

const mocks=vi.hoisted(()=>({
  authenticate:vi.fn(),getUser:vi.fn(),query:vi.fn(),connect:vi.fn(),txQuery:vi.fn(),release:vi.fn(),
}));
vi.mock("pg",()=>({Pool:class {query=mocks.query;connect=mocks.connect;}}));
vi.mock("@clerk/backend",()=>({createClerkClient:()=>({authenticateRequest:mocks.authenticate,users:{getUser:mocks.getUser}})}));
vi.mock("@clerk/shared/keys",()=>({publishableKeyFromHost:()=>"unit-test-publishable-key"}));
vi.mock("@tanstack/react-start/server",()=>({getRequest:()=>new Request("https://unit-test.example/api/account",{method:"POST"})}));
import { adminState, reviewWorkshop, editAdminVehicle, grantTierOverride, revokeTierOverride, extendWorkshopTrial, developmentRole, createService, verifyStamp } from "@/services/server/accounts";

const ownerEmail="kieranroe23@hotmail.co.uk";
const primary=(emailAddress=ownerEmail,status="verified")=>({id:"primary",emailAddress,verification:{status}});
const base=()=>({...sampleAccount().user,id:"clerk-owner",email:ownerEmail,role:"civilian" as const,
  subscription_tier:"free" as const,permissions:[],is_sample:false,garage_verified:false,dev_role:null,password_hash:null});
beforeEach(()=>{
  vi.resetAllMocks();
  mocks.authenticate.mockResolvedValue({toAuth:()=>({userId:"clerk-owner"})});
  mocks.getUser.mockResolvedValue({primaryEmailAddressId:"primary",emailAddresses:[primary()],firstName:"Owner",lastName:""});
  mocks.query.mockImplementation(async(sql:string)=>{
    if(sql==="SELECT * FROM user_accounts WHERE id=$1") return {rows:[base()]};
     if(sql.startsWith("SELECT u.id,u.email") || sql.startsWith("SELECT id,email")) {
      const {password_hash:_password,dev_role:_role,stripe_customer_id:_stripe,permissions:_permissions,...profile}=base();
      return {rows:[profile]};
    }
    if(sql.startsWith("SELECT id,vin,vrm,data")||sql.startsWith("SELECT * FROM vehicles")) {
      return {rows:[{id:"AB14CDE",vin:"WAUZZZ8K9EA000001",vrm:"AB14CDE",data:sampleAccount().vehicles[0],owner_user_id:"another-owner",status:"approved",is_sample:true}]};
    }
    return {rows:[],rowCount:1};
  });
  mocks.txQuery.mockResolvedValue({rows:[{id:"application"}],rowCount:1});
  mocks.connect.mockResolvedValue({query:mocks.txQuery,release:mocks.release});
});
afterEach(()=>vi.unstubAllEnvs());

describe("Verified server-side owner permissions",()=>{
  it("assigns exact God Mode rights from the verified primary address",()=>{
    const result=applyAdminPolicy(base(),primary(ownerEmail.toUpperCase()));
    expect(result.role).toBe("dev_admin");
    expect(result.subscription_tier).toBe("god_mode");
    expect(result.permissions).toEqual(ADMIN_PERMISSIONS);
    expect(result.id).toBe("clerk-owner");
  });
  it.each([primary(ownerEmail,"unverified"),primary("someone@example.com"),undefined])("does not trust an unverified, other or missing primary email",email=>{
    const stale={...base(),role:"dev_admin" as const,subscription_tier:"god_mode" as const,permissions:["all_access"]};
    const result=applyAdminPolicy(stale,email);
    expect(result.role).toBe("civilian");
    expect(result.subscription_tier).toBe("free");
    expect(result.permissions).toEqual([]);
  });
  it.each([
    ()=>adminState(),
    ()=>reviewWorkshop({id:"application",status:"approved"}),
    ()=>editAdminVehicle({vrm:"AB14CDE",make:"Audi",model:"A4",odometer:88000}),
     ()=>grantTierOverride("target-user"),
     ()=>revokeTierOverride("target-user"),
     ()=>extendWorkshopTrial("target-user"),
  ])("rejects unauthenticated admin reads and mutations before querying the database",async action=>{
    mocks.authenticate.mockResolvedValue({toAuth:()=>({userId:null})});
    await expect(action()).rejects.toThrow("Sign in");
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.connect).not.toHaveBeenCalled();
  });
  it("does not promote an owner email that is only a secondary address",async()=>{
    mocks.getUser.mockResolvedValue({primaryEmailAddressId:"primary",emailAddresses:[primary("other@example.com"),{...primary(),id:"secondary"}]});
    await expect(adminState()).rejects.toThrow("SuperAdmin access");
    expect(mocks.query.mock.calls.some(([sql])=>String(sql).startsWith("SELECT u.id,u.email"))).toBe(false);
  });
  it("returns authorized directory data without selecting credentials or ownership reference hashes",async()=>{
    const data=await adminState();
    expect(data.users[0]?.role).toBe("dev_admin");
    expect(data.users[0]?.subscription_tier).toBe("god_mode");
    expect(data.vehicles[0]?.owner_user_id).toBe("another-owner");
    const directorySql=mocks.query.mock.calls.filter(([sql])=>String(sql).startsWith("SELECT u.id,u.email")||String(sql).startsWith("SELECT id,")).map(([sql])=>sql).join(" ");
    expect(directorySql).not.toContain("password_hash");
    expect(directorySql).not.toContain("v5c_reference_hash");
    expect(mocks.authenticate.mock.calls[0]?.[0].method).toBe("GET");
  });
  it("makes lower-tier switching presentation-only for the owner",async()=>{
    await developmentRole("Owner");
    const updates=mocks.query.mock.calls.filter(([sql])=>sql.startsWith("UPDATE"));
    expect(updates).toEqual([["UPDATE user_accounts SET dev_role=$1 WHERE id=$2",["Owner","clerk-owner"]]]);
  });
  it("commits approval and applicant notification together, preserving sample provenance",async()=>{
    await reviewWorkshop({id:"application",status:"approved",vat_verified:true});
    expect(mocks.txQuery.mock.calls[0]?.[0]).toBe("BEGIN");
    const update=mocks.txQuery.mock.calls.find(([sql])=>sql.startsWith("UPDATE user_accounts"));
    expect(update?.[1].slice(0,4)).toEqual(["approved",true,"application","clerk-owner"]);
    expect(update?.[0]).toContain("status='pending'");
    expect(update?.[0]).not.toContain("is_sample=false");
    expect(mocks.txQuery.mock.calls.at(-1)?.[0]).toBe("COMMIT");
    expect(mocks.release).toHaveBeenCalledOnce();
  });
  it("never treats approval alone as VAT evidence",async()=>{
    await expect(reviewWorkshop({id:"application",status:"approved"})).rejects.toThrow("supporting VAT verification");
    expect(mocks.connect).not.toHaveBeenCalled();
  });
  it("rolls back a review when notification fails",async()=>{
    mocks.txQuery.mockImplementation(async(sql:string)=>{
      if(sql.startsWith("INSERT INTO account_notifications")) throw new Error("Notification failed");
      return {rowCount:1,rows:[{id:"application"}]};
    });
    await expect(reviewWorkshop({id:"application",status:"approved",vat_verified:true})).rejects.toThrow("Notification failed");
    expect(mocks.txQuery.mock.calls.at(-1)?.[0]).toBe("ROLLBACK");
    expect(mocks.txQuery.mock.calls.some(([sql])=>sql==="COMMIT")).toBe(false);
  });
  it("rejects an already-reviewed application rather than silently approving again",async()=>{
    mocks.txQuery.mockImplementation(async(sql:string)=>({rows:[],rowCount:sql.startsWith("UPDATE")?0:1}));
    await expect(reviewWorkshop({id:"application",status:"approved",vat_verified:true})).rejects.toThrow("no longer pending");
    expect(mocks.txQuery.mock.calls.at(-1)?.[0]).toBe("ROLLBACK");
  });
  it("edits only vehicle details, not ownership or V5C references",async()=>{
    await editAdminVehicle({vrm:"AB14 CDE",make:"Audi",model:"A4 corrected",odometer:88000});
    const update=mocks.txQuery.mock.calls.find(([sql])=>sql.startsWith("UPDATE vehicles"));
    expect(JSON.parse(update?.[1][0])).toEqual({make:"Audi",model:"A4 corrected",odometer:88000});
    expect(update?.[1][1]).toBe("AB14CDE");
    expect(update?.[0]).not.toContain("owner_user_id=");
    expect(mocks.txQuery.mock.calls.at(-1)?.[0]).toBe("COMMIT");
  });
  it("records lifetime tier grants against the acting verified administrator",async()=>{
    await grantTierOverride("target-user");
    const grant=mocks.txQuery.mock.calls.find(([sql])=>String(sql).startsWith("INSERT INTO tier_overrides"));
    expect(grant?.[0]).toContain("pro_modder_lifetime");
    expect(grant?.[1]).toEqual(["target-user","clerk-owner"]);
    expect(mocks.txQuery.mock.calls.at(-1)?.[0]).toBe("COMMIT");
  });
  it("revokes only the free lifetime override, without deleting the account",async()=>{
    await revokeTierOverride("target-user");
    expect(mocks.txQuery.mock.calls.some(([sql])=>String(sql).startsWith("DELETE FROM tier_overrides WHERE user_id=$1"))).toBe(true);
    expect(mocks.txQuery.mock.calls.some(([sql])=>String(sql).startsWith("DELETE FROM user_accounts"))).toBe(false);
    expect(mocks.txQuery.mock.calls.at(-1)?.[0]).toBe("COMMIT");
  });
  it("extends an approved VAT-verified workshop trial by 30 days",async()=>{
    await extendWorkshopTrial("target-workshop");
    const extension=mocks.txQuery.mock.calls.find(([sql])=>String(sql).startsWith("UPDATE user_accounts SET subscription_status='trialing'"));
    expect(extension?.[0]).toContain("interval '30 days'");
    expect(extension?.[0]).toContain("vat_verified=true");
    expect(extension?.[1]).toEqual(["target-workshop","clerk-owner",true]);
  });
  it("can sign a vehicle record as the administrator without impersonating its garage",async()=>{
    vi.stubEnv("SESSION_SECRET","unit-test-signing-key-only");
    mocks.txQuery.mockImplementation(async(sql:string)=>{
      if(sql.startsWith("SELECT * FROM vehicles"))return{rows:[{id:"AB14CDE",vin:"WAUZZZ8K9EA000001",vrm:"AB14CDE",data:sampleAccount().vehicles[0],owner_user_id:"another-owner",status:"approved",is_sample:true}],rowCount:1};
      return{rows:[],rowCount:1};
    });
    const record=await createService({vrm:"AB14CDE",date:"2026-10-07",mileage:88000,category:"Servicing",
      description:"Admin inspection",items:["Inspection"],garage:"Pretend Garage",physically_inspected_vin:true});
    expect(record.garage).toBe("V5Vault administrator");
    expect(record.stamped_by_garage_id).toBe("clerk-owner");
    expect(record.stamp_authority).toBe("administrator");
    expect(record.is_verified_stamp).toBe(true);
    expect(record.is_sample).toBe(true);
    const insertion=mocks.txQuery.mock.calls.find(([sql])=>sql.startsWith("INSERT INTO service_records"));
    mocks.query.mockResolvedValueOnce({rows:[{id:record.id,vehicle_id:"AB14CDE",vin:"WAUZZZ8K9EA000001",vrm:"AB14CDE",data:JSON.parse(insertion?.[1][5]),
      is_sample:true,is_verified_stamp:true,stamped_by_garage_id:"clerk-owner",stamp_signature:record.stamp_signature}]});
    const proof=await verifyStamp(record.id);
    expect(proof.valid).toBe(true);
    expect(proof.stamp_authority).toBe("administrator");
  });
});
describe("Deterministic post-login destinations",()=>{
  it("routes owners to admin even while they preview a free or garage view",()=>{
    expect(accountHome(sampleAccount())).toBe("/admin");
    expect(accountHome({...sampleAccount(),development_role:"Owner"})).toBe("/admin");
    expect(accountHome({...sampleAccount(),development_role:"Garage"})).toBe("/admin");
  });
  it("routes normal users to vehicle and verified workshops to garage",()=>{
    expect(accountHome({...sampleAccount(),user:base(),development_role:null})).toBe("/vehicle");
    expect(accountHome({...sampleAccount(),user:{...base(),role:"verified_garage"},development_role:null})).toBe("/garage");
    expect(isAuthEntry("/sign-in/sso-callback")).toBe(true);
    expect(isAuthEntry("/sign-up/verify-email-address")).toBe(true);
    expect(isAuthEntry("/vehicle")).toBe(false);
    expect(isAuthEntry("/admin")).toBe(false);
  });
});

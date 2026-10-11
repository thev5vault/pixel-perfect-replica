import type { ReactNode } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AccountProvider, useAccount } from "@/lib/account-store";
import { sampleAccount, previewEnabled, setPreviewEnabled, SAMPLE_PREVIEW_KEY } from "@/lib/sample-account";

const mocks=vi.hoisted(()=>({
  auth:{isLoaded:true,isSignedIn:false,user:null as null|{id:string}},
  getState:vi.fn(),saveProfile:vi.fn(),signOut:vi.fn(),role:vi.fn(),review:vi.fn(),edit:vi.fn(),admin:vi.fn(),
}));
vi.mock("@clerk/react",()=>({useUser:()=>mocks.auth,useClerk:()=>({signOut:mocks.signOut})}));
vi.mock("@/services/accountApi",()=>({
  getAccountState:mocks.getState,saveAccount:mocks.saveProfile,switchDevelopmentRole:mocks.role,getAdminState:mocks.admin,
  reviewWorkshop:mocks.review,editAdminVehicle:mocks.edit,
}));
const wrapper=({children}:{children:ReactNode})=><AccountProvider>{children}</AccountProvider>;
beforeEach(()=>{
  vi.clearAllMocks();
  setPreviewEnabled(false);
  sessionStorage.clear();
  localStorage.clear();
  mocks.auth={isLoaded:true,isSignedIn:false,user:null};
  mocks.getState.mockRejectedValue(new Error("Sign in to continue."));
});
afterEach(()=>{cleanup();setPreviewEnabled(false);vi.unstubAllEnvs();});
describe("Session continuity and isolated developer preview",()=>{
  it("retains an authenticated profile during Clerk's temporary reload instead of returning to landing",async()=>{
    mocks.auth={isLoaded:true,isSignedIn:true,user:{id:"owner"}};
    mocks.getState.mockResolvedValue({...sampleAccount(),user:{...sampleAccount().user,id:"owner"}});
    const {result,rerender}=renderHook(useAccount,{wrapper});
    await waitFor(()=>expect(result.current?.state?.user.id).toBe("owner"));
    mocks.auth={isLoaded:false,isSignedIn:false,user:null};
    rerender();
    expect(result.current?.signedIn).toBe(true);
    expect(result.current?.state?.user.id).toBe("owner");
    expect(result.current?.authLoaded).toBe(false);
    mocks.auth={isLoaded:true,isSignedIn:true,user:{id:"owner"}};
    rerender();
    await waitFor(()=>expect(result.current?.loading).toBe(false));
    expect(result.current?.state?.user.id).toBe("owner");
  });
  it("clears profile data on a confirmed sign-out",async()=>{
    mocks.auth={isLoaded:true,isSignedIn:true,user:{id:"owner"}};
    mocks.getState.mockResolvedValueOnce({...sampleAccount(),user:{...sampleAccount().user,id:"owner"}});
    const {result,rerender}=renderHook(useAccount,{wrapper});
    await waitFor(()=>expect(result.current?.state).not.toBeNull());
    mocks.auth={isLoaded:true,isSignedIn:false,user:null};
    mocks.getState.mockRejectedValueOnce(new Error("Sign in to continue."));
    rerender();
    await waitFor(()=>expect(result.current?.state).toBeNull());
    expect(result.current?.signedIn).toBe(false);
  });
  it("keeps a signed-in backend error explicit, not a new sign-in redirect",async()=>{
    mocks.auth={isLoaded:true,isSignedIn:true,user:{id:"owner"}};
    mocks.getState.mockRejectedValueOnce(new Error("Temporary account failure"));
    const {result}=renderHook(useAccount,{wrapper});
    await waitFor(()=>expect(result.current?.error).toBe("Temporary account failure"));
    expect(result.current?.signedIn).toBe(true);
    expect(result.current?.loading).toBe(false);
  });
  it("updates the shared profile immediately after a successful display-name save",async()=>{
    mocks.auth={isLoaded:true,isSignedIn:true,user:{id:"owner"}};
    mocks.getState.mockResolvedValue({...sampleAccount(),user:{...sampleAccount().user,id:"owner",full_name:"Original Name"}});
    mocks.saveProfile.mockResolvedValue(undefined);
    const {result}=renderHook(useAccount,{wrapper});
    await waitFor(()=>expect(result.current?.state?.user.full_name).toBe("Original Name"));

    await act(async()=>{await result.current?.saveProfile({full_name:"Updated Name"});});

    expect(mocks.saveProfile).toHaveBeenCalledWith({full_name:"Updated Name"});
    expect(result.current?.state?.user.full_name).toBe("Updated Name");
  });
  it("persists the selected display mode locally and to the signed-in profile",async()=>{
    mocks.auth={isLoaded:true,isSignedIn:true,user:{id:"owner"}};
    mocks.getState.mockResolvedValue({...sampleAccount(),user:{...sampleAccount().user,id:"owner",full_name:"Owner"}});
    mocks.saveProfile.mockResolvedValue(undefined);
    const {result}=renderHook(useAccount,{wrapper});
    await waitFor(()=>expect(result.current?.state?.user.id).toBe("owner"));
    await act(async()=>{await result.current?.setDisplayPreference("detailed");});
    expect(localStorage.getItem("v5vault_display_mode")).toBe("detailed");
    expect(mocks.saveProfile).toHaveBeenCalledWith({full_name:"Owner",display_preference:"detailed"});
    expect(result.current?.displayPreference).toBe("detailed");
  });
  it("hydrates a valid native passkey session when Clerk is signed out",async()=>{
    mocks.getState.mockResolvedValue({...sampleAccount(),user:{...sampleAccount().user,id:"passkey-owner"}});
    const {result}=renderHook(useAccount,{wrapper});
    await waitFor(()=>expect(result.current?.state?.user.id).toBe("passkey-owner"));
    expect(result.current?.signedIn).toBe(true);
    expect(result.current?.authLoaded).toBe(true);
  });
  it("shows a friendly retry state rather than bouncing to the landing page on a network error",async()=>{
    mocks.getState.mockRejectedValue(new TypeError("Load failed"));
    const {result}=renderHook(useAccount,{wrapper});
    await waitFor(()=>expect(result.current?.error).toBe("Your account couldn't be loaded. Check your connection and try again."));
    expect(result.current?.signedIn).toBe(true);
    expect(result.current?.state).toBeNull();
  });
  it("enters sample God Mode in one click and performs approvals, edits and stamps without real APIs",async()=>{
    const {result}=renderHook(useAccount,{wrapper});
    await waitFor(()=>expect(mocks.getState).toHaveBeenCalledTimes(1));
    mocks.getState.mockClear();
    act(()=>result.current?.startPreview?.());
    expect(result.current?.preview).toBe(true);
    expect(result.current?.state?.user.role).toBe("dev_admin");
    expect(result.current?.state?.user.email).not.toBe("kieranroe23@hotmail.co.uk");
    expect(sessionStorage.getItem(SAMPLE_PREVIEW_KEY)).toBe("1");
    for(const role of ["Owner","DIY","Pro","Garage","superadmin"] as const) {
      await act(async()=>{await result.current?.switchRole(role);});
      expect(result.current?.state?.development_role).toBe(role);
      expect(result.current?.state?.user.role).toBe("dev_admin");
    }
    await act(async()=>{await result.current?.reviewWorkshop({id:"sample-specialist",status:"approved"});});
    expect((await result.current?.getAdminState())?.applications.some(u=>u.id==="sample-specialist")).toBe(false);
    await act(async()=>{await result.current?.editVehicle({vrm:"AB14CDE",make:"Audi",model:"A4 Preview",odometer:90000});});
    expect((await result.current?.getAdminState())?.vehicles[0]?.model).toBe("A4 Preview");
    await act(async()=>{await result.current?.addService({vrm:"AB14CDE",date:"2026-10-07",mileage:90000,category:"Servicing",description:"Preview job",items:["Oil filter"],garage:"Sample Workshop"});});
    expect(result.current?.state?.services.at(-1)?.is_sample).toBe(true);
    expect(result.current?.state?.services.at(-1)?.stamp_signature).toBeNull();
    expect(mocks.getState).not.toHaveBeenCalled();
    for(const mock of [mocks.role,mocks.admin,mocks.review,mocks.edit,mocks.signOut]) expect(mock).not.toHaveBeenCalled();
  });
  it("restores sample access after reload without needing a Clerk session",()=>{
    setPreviewEnabled(true);
    const {result}=renderHook(useAccount,{wrapper});
    expect(result.current?.preview).toBe(true);
    expect(result.current?.signedIn).toBe(true);
    expect(result.current?.state?.development_role).toBe("superadmin");
    expect(mocks.getState).not.toHaveBeenCalled();
  });
  it("cannot enable the sample shortcut in production",()=>{
    vi.stubEnv("DEV",false);
    sessionStorage.setItem(SAMPLE_PREVIEW_KEY,"1");
    expect(previewEnabled()).toBe(false);
    const {result}=renderHook(useAccount,{wrapper});
    act(()=>result.current?.startPreview?.());
    expect(result.current?.preview).toBe(false);
    expect(result.current?.signedIn).toBe(false);
  });
});

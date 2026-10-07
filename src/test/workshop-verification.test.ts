import { describe, it, expect } from "vitest";
import { mayStamp, sampleApproval, signStamp, checkStamp, referenceAction } from "@/services/server/verification";

describe("Development sample verification boundaries",()=>{
  it("never lets another keeper reuse either the current or any historical reference",()=>{
    expect(referenceAction(true,false,true)).toBe("reject");
    expect(referenceAction(true,false,false)).toBe("reject");
    expect(referenceAction(true,true,false)).toBe("reject");
    expect(referenceAction(true,true,true)).toBe("unchanged");
    expect(referenceAction(false,false,false)).toBe("consume");
  });
  it("approves only approved samples in development",()=>{
    expect(sampleApproval(true,true,"approved")).toBe(true);
    expect(sampleApproval(false,true,"approved")).toBe(false);
    expect(sampleApproval(true,false,"approved")).toBe(false);
    expect(sampleApproval(true,true,"pending")).toBe(false);
  });
  it("only permits approved, verified garages and confines sample stamps to sample vehicles",()=>{
    const allowed={role:"verified_garage",verified:true,status:"approved",garageSample:true,vehicleSample:true,development:true};
    expect(mayStamp(allowed)).toBe(true);
    expect(mayStamp({...allowed,role:"civilian"})).toBe(false);
    expect(mayStamp({...allowed,role:"modder"})).toBe(false);
    expect(mayStamp({...allowed,verified:false})).toBe(false);
    expect(mayStamp({...allowed,status:"pending"})).toBe(false);
    expect(mayStamp({...allowed,development:false})).toBe(false);
    expect(mayStamp({...allowed,vehicleSample:false})).toBe(false);
    expect(mayStamp({...allowed,garageSample:false,vehicleSample:false,development:false})).toBe(true);
  });
  it("detects payload, signer and sample-label tampering",()=>{
    const data={vrm:"AB14CDE",description:"Oil & Filter",mileage:89000};
    const signature=signStamp("record","garage",data,true,"test-only-signing-key");
    expect(checkStamp("record","garage",data,true,signature,"test-only-signing-key")).toBe(true);
    expect(checkStamp("record","garage",{mileage:89000,description:"Oil & Filter",vrm:"AB14CDE"},true,signature,"test-only-signing-key")).toBe(true);
    expect(checkStamp("record","garage",{...data,mileage:1},true,signature,"test-only-signing-key")).toBe(false);
    expect(checkStamp("record","other",data,true,signature,"test-only-signing-key")).toBe(false);
    expect(checkStamp("record","garage",data,false,signature,"test-only-signing-key")).toBe(false);
  });
});

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useV1 } from "@/lib/use-v1";
import { can, useVault } from "@/lib/vault-store";
import { gbp } from "@/lib/plans";
export function VehicleDataTools() {
  const {vehicle,services,role}=useVault(),v1=useV1(),attempted=useRef(new Set<string>());
  useEffect(()=>{
    if(vehicle.source!=="official"||vehicle.access==="archived"||attempted.current.has(vehicle.vrm))return;
    attempted.current.add(vehicle.vrm);
    void v1.refreshVehicle(vehicle.vrm).catch(()=>toast.info("Official refresh is unavailable. Previously fetched details remain unchanged."));
  },[vehicle.vrm,vehicle.source,vehicle.access,v1]);
  const entries=services.filter(s=>s.vrm===vehicle.vrm);
  const sum=(key:"cost"|"partsCost"|"labourCost")=>entries.reduce((n,s)=>n+(s[key]??0),0);
  return <section className="vault-card space-y-3 p-4">
    <p className="text-sm text-muted-foreground">{vehicle.fuelType??"Fuel not returned"} · {vehicle.engineCapacity?`${vehicle.engineCapacity} cc`:"Engine size not returned"} · {vehicle.taxStatus??"Tax status not returned"}{vehicle.taxDueDate?` · tax due ${vehicle.taxDueDate}`:""}</p>
    {can.diy(role)&&<div className="grid grid-cols-3 gap-2 text-center">{(["cost","partsCost","labourCost"] as const).map((key,i)=><div key={key}><p className="text-xs text-muted-foreground">{["Recorded spend","Parts","Labour"][i]}</p><p className="mt-1 font-semibold text-cyan-300">{gbp(Math.round(sum(key)*100))}</p></div>)}</div>}
    {vehicle.source==="official"&&vehicle.access!=="archived"&&<button className="btn-ghost w-full" onClick={()=>void v1.refreshVehicle(vehicle.vrm).then(r=>toast.success(r.message)).catch(e=>toast.error(e instanceof Error?e.message:"Refresh failed"))}>Refresh official MOT & tax details</button>}
    {vehicle.source==="demo"&&<p className="text-xs text-amber-300">Development sample. These are not live DVLA readings.</p>}
  </section>;
}

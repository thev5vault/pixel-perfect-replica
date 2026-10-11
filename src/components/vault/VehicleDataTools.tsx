import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { useV1 } from "@/lib/use-v1";
import { useVault } from "@/lib/vault-store";
export function VehicleDataTools() {
  const {vehicle}=useVault(),v1=useV1(),attempted=useRef(new Set<string>());
  useEffect(()=>{
    if(vehicle.source!=="official"||vehicle.access==="archived"||attempted.current.has(vehicle.vrm))return;
    attempted.current.add(vehicle.vrm);
    void v1.refreshVehicle(vehicle.vrm).catch(()=>toast.info("Official refresh is unavailable. Previously fetched details remain unchanged."));
  },[vehicle.vrm,vehicle.source,vehicle.access,v1]);
  const canRefresh=vehicle.source==="official"&&vehicle.access!=="archived";
  if(!canRefresh)return null;
  return <section className="vault-card space-y-3 p-4">
    <button className="btn-ghost w-full" onClick={()=>void v1.refreshVehicle(vehicle.vrm).then(r=>toast.success(r.message)).catch(e=>toast.error(e instanceof Error?e.message:"Refresh failed"))}>Refresh official MOT & tax details</button>
  </section>;
}

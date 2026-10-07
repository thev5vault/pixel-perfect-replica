import { useCallback, useMemo, useRef, useState } from "react";
import type { AccountContext } from "./account-store";
import type { AccountState, AdminUser } from "./account-types";
import { sampleAccount, sampleUsers } from "./sample-account";

const sampleId = () => `preview-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
export function useSampleAccount(exit: () => void): AccountContext {
  const [data, setData] = useState(() => {
    const account = sampleAccount();
    return { account, users: sampleUsers(account) };
  });
  const latest = useRef(data);
  const commit = useCallback((fn:(d:typeof data)=>typeof data)=>{
    const next=fn(latest.current);
    latest.current=next;
    setData(next);
  },[]);
  return useMemo<AccountContext>(() => {
    const state = data.account;
    const vehicleExists = (vrm: string) => {
      if (!state.vehicles.some(v => v.vrm === vrm)) throw new Error("Sample preview only supports AB14 CDE and ZX19 XYZ. No real vehicle was changed.");
    };
    const change = (fn: (s: AccountState) => AccountState) => commit(d => ({...d, account: fn(d.account)}));
    return {
      state, preview: true, authLoaded: true, signedIn: true, loading: false, error: null,
      refresh: async () => {},
      signOut: async () => exit(),
      switchRole: async role => change(s => ({...s, development_role: role})),
      claimVehicle: async (raw, reference) => {
        const vrm=raw.toUpperCase().replace(/[^A-Z0-9]/g,"");
        vehicleExists(vrm);
        if (!/^\d{11}$/.test(reference)) throw new Error("Use an 11-digit sample V5C reference.");
        change(s => ({...s, vehicles:s.vehicles.map(v=>v.vrm===vrm?{...v,owner_user_id:s.user.id}:v)}));
        return {status:"approved",is_sample:true,message:"Sample link approved. No real ownership was changed."};
      },
      saveProfile: async profile => change(s=>({...s,user:{...s.user,...profile}})),
      addService: async record => {
        vehicleExists(record.vrm);
        const stamped=state.development_role==="Garage"||state.development_role==="superadmin";
        change(s=>({...s,services:[...s.services,{...record,id:sampleId(),verified:stamped,
          is_verified_stamp:stamped,tier3:stamped,is_sample:true,status:"approved",
          garage:stamped?"Sample Workshop (simulated stamp)":"Sample owner record",
          stamped_by_garage_id:stamped?s.user.id:null,stamp_signature:null,
          has_receipt:Boolean(record.image),has_invoice:Boolean(record.invoice_data)}]}));
      },
      addMod: async record => {
        vehicleExists(record.vrm);
        change(s=>({...s,mods:[...s.mods,{...record,id:sampleId(),status:"active"}]}));
      },
      revertMod: async (id,date,mileage) => {
        if(!state.mods.some(m=>m.id===id)) throw new Error("Sample modification not found.");
        change(s=>({...s,mods:s.mods.map(m=>m.id===id?{...m,status:"reverted",removalDate:date,removalMileage:mileage}:m)}));
      },
      markRead: async () => change(s=>({...s,notifications:s.notifications.map(n=>({...n,read:true}))})),
      book: async (vrm,date,notes) => {
        vehicleExists(vrm);
        change(s=>({...s,bookings:[...s.bookings,{id:sampleId(),vrm,date,notes,status:"booked"}]}));
      },
      updateBooking: async (id,status) => {
        if(!state.bookings.some(b=>b.id===id)) throw new Error("Sample booking not found.");
        change(s=>({...s,bookings:s.bookings.map(b=>b.id===id?{...b,status}:b)}));
      },
      getAdminState: async () => {
        const current=latest.current;
        return {users:current.users.map(u=>u.id===current.account.user.id?current.account.user:u),vehicles:current.account.vehicles,
          applications:current.users.filter(u=>u.status==="pending"&&u.garage_name&&u.garage_registration)};
      },
      reviewWorkshop: async ({id,status}) => {
        if(!data.users.some(u=>u.id===id&&u.status==="pending")) throw new Error("Sample application is no longer pending.");
        commit(d=>({...d,users:d.users.map((u):AdminUser=>u.id===id?{...u,status,garage_verified:status==="approved",
          role:status==="approved"?"verified_garage":"civilian",subscription_tier:status==="approved"?"verified_garage":"free"}:u)}));
      },
      editVehicle: async input => {
        vehicleExists(input.vrm);
        change(s=>({...s,vehicles:s.vehicles.map(v=>v.vrm===input.vrm?{...v,...input}:v)}));
      },
    };
  }, [data, exit,commit]);
}

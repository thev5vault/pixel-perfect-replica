import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useUser, useClerk } from "@clerk/react";
import type { AccountState } from "./account-types";
import type { Role, ServiceInput, Modification } from "./vault-store";
import * as api from "@/services/accountApi";

export interface AccountContext {
  state: AccountState | null;
  loading: boolean;
  error: string | null;
  signedIn: boolean;
  refresh: () => Promise<void>;
  claimVehicle: (vrm: string, reference: string) => Promise<{ status: "approved" | "pending"; is_sample: boolean; message: string }>;
  switchRole: (role: Role) => Promise<void>;
  saveProfile: (profile: { full_name: string; garage_name: string; garage_registration: string }) => Promise<void>;
  addService: (record: ServiceInput) => Promise<void>;
  addMod: (record: Omit<Modification,"id"|"status">) => Promise<void>;
  revertMod: (id: string, date: string, mileage: number) => Promise<void>;
  markRead: () => Promise<void>;
  book: (vrm: string, date: string, notes: string) => Promise<void>;
  updateBooking: (id: string, status: "completed" | "cancelled") => Promise<void>;
  signOut: () => Promise<void>;
}
const Context = createContext<AccountContext | null>(null);
export function AccountProvider({children}:{children:ReactNode}) {
  const {isLoaded,isSignedIn,user} = useUser();
  const clerk = useClerk();
  const [state,setState] = useState<AccountState|null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState<string|null>(null);
  const activeIdentity = useRef(user?.id);
  activeIdentity.current = user?.id;
  const refresh = useCallback(async () => {
    const identity=user?.id;
    if(!isSignedIn || !identity) return;
    try {
      const result=await api.getAccountState();
      if(result.user.id!==identity) throw new Error("Account identity mismatch. Sign in again.");
      if(activeIdentity.current===identity) {setState(result);setError(null);}
    }
    catch(e) {if(activeIdentity.current===identity) setError(e instanceof Error?e.message:"Account could not be loaded.");throw e;}
    finally {if(activeIdentity.current===identity) setLoading(false);}
  },[isSignedIn,user?.id]);
  useEffect(()=>{
    let active=true;
    setState(null);
    if(!isLoaded) return;
    if(!isSignedIn) {setLoading(false);setError(null);return;}
    setLoading(true);
    void refresh().catch(()=>{if(active) setLoading(false);});
    const interval=setInterval(()=>{void refresh().catch(()=>{});},30000);
    return ()=>{active=false;clearInterval(interval);};
  },[user?.id,isLoaded,isSignedIn,refresh]);
  const value = useMemo<AccountContext>(()=>({
    state,loading:!isLoaded||loading,error,signedIn:Boolean(isSignedIn),refresh,
    claimVehicle:async(vrm,reference)=>{const result=await api.claimVehicle({data:{vrm,reference}});await refresh();return result;},
    switchRole:async(role)=>{await api.switchDevelopmentRole({data:{role}});await refresh();},
    saveProfile:async(profile)=>{await api.saveAccount({data:profile});await refresh();},
    addService:async(record)=>{await api.createServiceRecord({data:record});await refresh();},
    addMod:async(record)=>{await api.saveModification({data:record});await refresh();},
    revertMod:async(id,date,mileage)=>{await api.revertModification({data:{id,date,mileage}});await refresh();},
    markRead:async()=>{await api.markNotificationsRead();await refresh();},
    book:async(vrm,date,notes)=>{await api.createBooking({data:{vrm,date,notes}});await refresh();},
    updateBooking:async(id,status)=>{await api.updateBooking({data:{id,status}});await refresh();},
    signOut:async()=>{setLoading(true);await clerk.signOut({redirectUrl:"/"});setState(null);},
  }),[state,loading,isLoaded,isSignedIn,error,refresh,clerk]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAccount() {return useContext(Context);}

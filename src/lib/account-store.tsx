import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useUser, useClerk } from "@clerk/react";
import type { AccountState, AdminState, AdminVehicleEdit, WorkshopReview, DisplayPreference } from "./account-types";
import { previewEnabled, setPreviewEnabled } from "./sample-account";
import { useSampleAccount } from "./use-sample-account";
import { clearPendingSignup } from "./signup-recovery";
import type { Role, ServiceInput, Modification } from "./vault-store";
import * as api from "@/services/accountApi";
import { endPasskeySession } from "@/services/passkeyClient";
import { mergeAccountProfile, type AccountProfileInput } from "./account-profile";

export interface AccountContext {
  state: AccountState | null;
  loading: boolean;
  error: string | null;
  signedIn: boolean;
  authLoaded?: boolean;
  preview?: boolean;
  displayPreference: DisplayPreference;
  hasChosenDisplayPreference: boolean;
  setDisplayPreference: (mode: DisplayPreference) => Promise<void>;
  startPreview?: () => void;
  refresh: () => Promise<void>;
  claimVehicle: (vrm: string, reference: string, vin?:string) => Promise<{ status: "approved" | "pending"; is_sample: boolean; message: string }>;
  switchRole: (role: Role) => Promise<void>;
  saveProfile: (profile: AccountProfileInput) => Promise<void>;
  getAdminState: () => Promise<AdminState>;
  reviewWorkshop: (input: WorkshopReview) => Promise<void>;
  editVehicle: (input: AdminVehicleEdit) => Promise<void>;
  grantTierOverride: (id: string) => Promise<void>;
  revokeTierOverride: (id: string) => Promise<void>;
  extendWorkshopTrial: (id: string) => Promise<void>;
  addService: (record: ServiceInput) => Promise<void>;
  addMod: (record: Omit<Modification,"id"|"status">) => Promise<void>;
  revertMod: (id: string, date: string, mileage: number) => Promise<void>;
  markRead: () => Promise<void>;
  book: (vrm: string, date: string, notes: string) => Promise<void>;
  updateBooking: (id: string, status: "completed" | "cancelled") => Promise<void>;
  signOut: () => Promise<void>;
}
const Context = createContext<AccountContext | null>(null);
const DISPLAY_MODE_KEY = "v5vault_display_mode";
function storedDisplayMode(): DisplayPreference | undefined {
  if (typeof window === "undefined") return undefined;
  const value = window.localStorage.getItem(DISPLAY_MODE_KEY);
  return value === "easy" || value === "detailed" ? value : undefined;
}
export function AccountProvider({children}:{children:ReactNode}) {
  const {isLoaded,isSignedIn,user} = useUser();
  const clerk = useClerk();
  const [preview,setPreview] = useState(previewEnabled);
  const exitPreview = useCallback(()=>{setPreviewEnabled(false);setPreview(false);window.location.assign("/");},[]);
  const sample = useSampleAccount(exitPreview);
  const startPreview = useCallback(()=>{
    if(!import.meta.env.DEV) return;
    clearPendingSignup();
    setPreviewEnabled(true);
    setPreview(true);
  },[]);
  const [state,setState] = useState<AccountState|null>(null);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState<string|null>(null);
  const [displayPreference,setDisplayPreferenceState] = useState<DisplayPreference>(()=>storedDisplayMode() ?? "easy");
  const [hasChosenDisplayPreference,setHasChosenDisplayPreference] = useState(()=>typeof window!=="undefined"&&window.localStorage.getItem("v5vault_display_mode_confirmed")==="true");
  useEffect(()=>{
    document.documentElement.dataset["displayMode"]=displayPreference;
  },[displayPreference]);
  const [nativeSession,setNativeSession] = useState(false);
  const [nativeSessionChecked,setNativeSessionChecked] = useState(false);
  const signedIn = Boolean(isSignedIn||nativeSession||(!isLoaded&&state));
  const displaySyncedUser = useRef<string|undefined>(undefined);
  const activeIdentity = useRef(user?.id);
  if (isLoaded && isSignedIn && user?.id) activeIdentity.current = user.id;
  const loadErrorMessage = (value:unknown) => {
    const message=value instanceof Error?value.message:"";
    return /load failed|failed to fetch|networkerror|network request failed/i.test(message)
      ? "Your account couldn't be loaded. Check your connection and try again."
      : message || "Your account details could not be loaded.";
  };
  const refresh = useCallback(async () => {
    const identity=isSignedIn?user?.id:nativeSession?activeIdentity.current:undefined;
    if(!isSignedIn&&!nativeSession) return;
    try {
      const result=await api.getAccountState();
      if(identity && result.user.id!==identity) throw new Error("Account identity mismatch. Sign in again.");
      activeIdentity.current=result.user.id;
      setState(result);setError(null);setNativeSession(!isSignedIn);
    }
    catch(e) {setError(loadErrorMessage(e));throw e;}
    finally {setLoading(false);}
  },[isSignedIn,user?.id,nativeSession]);
  useEffect(()=>{
    let active=true;
    if(preview) return;
    if(!isLoaded) {setLoading(true);return;}
    if(isSignedIn && user?.id) {
      setNativeSession(false);
      setNativeSessionChecked(true);
      activeIdentity.current=user.id;
      setState(previous=>previous?.user.id===user.id?previous:null);
      setLoading(true);
      void refresh().catch(()=>{if(active) setLoading(false);});
      const interval=setInterval(()=>{void refresh().catch(()=>{});},30000);
      return ()=>{active=false;clearInterval(interval);};
    }
    if(nativeSession) {
      setNativeSessionChecked(true);
      const interval=setInterval(()=>{void refresh().catch(()=>{});},30000);
      return ()=>{active=false;clearInterval(interval);};
    }
    activeIdentity.current=undefined;
    setNativeSessionChecked(false);
    setState(null);
    setError(null);
    setLoading(true);
    void api.getAccountState().then(result=>{
      if(!active) return;
      activeIdentity.current=result.user.id;
      setState(result);
      setNativeSession(true);
    }).catch((e)=>{
      if(!active) return;
      activeIdentity.current=undefined;
      setState(null);
      if (/sign in to continue|unauthorized|\b401\b/i.test(e instanceof Error?e.message:String(e))) {
        setNativeSession(false);
        setError(null);
      } else {
        setNativeSession(true);
        setError(loadErrorMessage(e));
      }
    }).finally(()=>{
      if(active) {setNativeSessionChecked(true);setLoading(false);}
    });
    return ()=>{active=false;};
  },[user?.id,isLoaded,isSignedIn,refresh,preview,nativeSession]);
  useEffect(()=>{
    const accountUser=state?.user;
    if(!signedIn||!accountUser||displaySyncedUser.current===accountUser.id) return;
    displaySyncedUser.current=accountUser.id;
    const local=storedDisplayMode();
    if(local) {
      setDisplayPreferenceState(local);
      if(local!==accountUser.display_preference) {
        const profile={full_name:accountUser.full_name,display_preference:local};
        const apply=(previous:AccountState|null)=>previous?{...previous,user:mergeAccountProfile(previous.user,profile)}:previous;
        void Promise.resolve(api.saveAccount(profile)).then(()=>{setState(apply);return refresh();}).then(()=>setState(apply)).catch(()=>{});
      }
    } else {
      const mode=accountUser.display_preference ?? "easy";
      setDisplayPreferenceState(mode);
      window.localStorage.setItem(DISPLAY_MODE_KEY,mode);
    }
  },[signedIn,state?.user.id]);
  const saveProfile=useCallback(async(profile:AccountProfileInput)=>{
    await api.saveAccount(profile);
    const applySavedProfile=(previous:AccountState|null)=>previous
      ?{...previous,user:mergeAccountProfile(previous.user,profile)}
      :previous;
    setState(applySavedProfile);
    void refresh().then(()=>setState(applySavedProfile)).catch(()=>{});
  },[refresh]);
  const setDisplayPreference=useCallback(async(mode:DisplayPreference)=>{
    setDisplayPreferenceState(mode);
    if(typeof window!=="undefined") window.localStorage.setItem(DISPLAY_MODE_KEY,mode);
    if(typeof window!=="undefined") window.localStorage.setItem("v5vault_display_mode_confirmed","true");
    setHasChosenDisplayPreference(true);
    const accountUser=state?.user;
    if(accountUser) await saveProfile({full_name:accountUser.full_name,display_preference:mode});
  },[state?.user,saveProfile]);
  const value = useMemo<AccountContext>(()=>({
    state:state?.user.id===activeIdentity.current?state:null,
    loading:!isLoaded||loading,error,signedIn:Boolean(isSignedIn||nativeSession||(!isLoaded&&state)),
    authLoaded:Boolean(isLoaded&&(isSignedIn||nativeSessionChecked)),preview:false,startPreview,refresh,
    displayPreference,hasChosenDisplayPreference,setDisplayPreference,
    getAdminState:async()=>api.getAdminState(),
    reviewWorkshop:async(input)=>{await api.reviewWorkshop({data:input});await refresh();},
    editVehicle:async(input)=>{await api.editAdminVehicle({data:input});await refresh();},
    grantTierOverride:async(id)=>{await api.grantTierOverride({data:{id}});await refresh();},
    revokeTierOverride:async(id)=>{await api.revokeTierOverride({data:{id}});await refresh();},
    extendWorkshopTrial:async(id)=>{await api.extendWorkshopTrial({data:{id}});await refresh();},
    claimVehicle:async(vrm,reference,vin)=>{const result=await api.claimVehicle({data:{vrm,reference,...(vin?{vin}:{})}});await refresh();return result;},
    switchRole:async(role)=>{await api.switchDevelopmentRole({data:{role}});await refresh();},
      saveProfile,
    addService:async(record)=>{await api.createServiceRecord({data:record});await refresh();},
    addMod:async(record)=>{await api.saveModification({data:record});await refresh();},
    revertMod:async(id,date,mileage)=>{await api.revertModification({data:{id,date,mileage}});await refresh();},
    markRead:async()=>{await api.markNotificationsRead();await refresh();},
    book:async(vrm,date,notes)=>{await api.createBooking({data:{vrm,date,notes}});await refresh();},
    updateBooking:async(id,status)=>{await api.updateBooking({data:{id,status}});await refresh();},
    signOut:async()=>{
      setLoading(true);
      try { await endPasskeySession(); }
      catch (e) { setLoading(false); throw e; }
      setNativeSession(false);setNativeSessionChecked(true);activeIdentity.current=undefined;setState(null);setError(null);
      if(isSignedIn) await clerk.signOut({redirectUrl:"/"});
      else {setLoading(false);window.location.assign("/");}
    },
  }),[state,loading,isLoaded,isSignedIn,nativeSession,nativeSessionChecked,error,refresh,clerk,startPreview,displayPreference,setDisplayPreference,saveProfile]);
  return <Context.Provider value={preview&&import.meta.env.DEV?{...sample,displayPreference,hasChosenDisplayPreference,setDisplayPreference}:value}>{children}</Context.Provider>;
}
export function useAccount() {return useContext(Context);}

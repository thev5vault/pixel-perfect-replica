import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, Navigate, useLocation, useNavigate } from "@tanstack/react-router";
import { Bell, Building2, CalendarDays, Car, ChevronDown, FileBadge, Lock, LogOut, Settings, ShieldCheck, Terminal, Wrench, Zap } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAccount } from "@/lib/account-store";
import { ROLES, ROLE_LABELS, formatVrm, useVault, type Role } from "@/lib/vault-store";
import { V5VaultLogo } from "./V5VaultLogo";
import { VehicleLookupDialog } from "./VehicleLookupDialog";
import { UnlockGate } from "./UnlockGate";
import { toast } from "sonner";
import { accountHome, isAuthEntry, shouldHoldAuthEntryForHydration } from "@/lib/auth-routing";
import { SessionRestoreScreen } from "./SessionRestoreScreen";

const OWNER = [
  { to: "/vehicle", label: "Vehicle", icon: Car },
  { to: "/vault", label: "Vault", icon: Lock },
  { to: "/passport", label: "Passport", icon: FileBadge },
] as const;
const PROFILE = { to: "/settings", label: "Profile", icon: Settings } as const;
const ADMIN = { to: "/admin", label: "Admin", icon: Terminal } as const;
const WORKSHOP = [
  { to: "/garage", label: "Express Stamp", icon: Zap },
  { to: "/queue", label: "Upcoming Jobs", icon: CalendarDays },
  { to: "/account", label: "Garage Profile", icon: Building2 },
] as const;
const ROLE_NAME: Record<Role, string> = {
  Owner: "Civilian · Free account", DIY: "Civilian · Pro DIY", Pro: "Modder · Pro Modder", Garage: "Verified garage", superadmin: "Development superadmin",
};

export function AppShell({ children }: { children: ReactNode }) {
  const account = useAccount();
  const vault = useVault();
  const location = useLocation();
  const path = location.pathname;
  const activeTab = `${location.pathname}${location.searchStr}${location.hash}`;
  const navigate = useNavigate();
  const [connectOpen, setConnectOpen] = useState(false);
  const [working, setWorking] = useState(false);
  const hasResolvedInitialAuth = useRef(false);
  if (account?.authLoaded) hasResolvedInitialAuth.current = true;
  const signed = Boolean(account?.signedIn && account.state);
   const isPublicPassportAlias = /^\/passport\/[^/]+(?:\/full)?\/?$/.test(path);
   const isPublic = isAuthEntry(path) || path.startsWith("/verify") || path.startsWith("/v/") || isPublicPassportAlias;
  const user = account?.state?.user;
   const role = account?.state?.development_role ?? (user?.role === "dev_admin" ? "superadmin" : user?.role === "verified_garage" ? "Garage" : user?.subscription_tier === "pro_modder" ? "Pro" : user?.subscription_tier === "pro_diy" ? "DIY" : "Owner");
   const isDeveloper = user?.role === "dev_admin";
   const isWorkshopTerminal = path === "/garage" || path === "/workshop";
   const isVerifiedWorkshop = Boolean(user && user.role === "verified_garage" && user.status === "approved" && user.garage_verified && user.vat_verified === true && (user.workshop_access_active || user.subscription_tier === "verified_garage"));
   const garage = Boolean(isDeveloper || isVerifiedWorkshop);
   const isWorkshopMode = isVerifiedWorkshop || (isDeveloper && (isWorkshopTerminal || path === "/queue" || path === "/bookings" || path === "/account"));
   const navItems = !signed ? [] : isWorkshopMode ? WORKSHOP : [...OWNER, isDeveloper ? ADMIN : PROFILE];
  const vehicles = account?.state?.vehicles ?? [];
  const active = vehicles.find((v) => v.vrm === vault.vehicle.vrm) ?? vehicles[0];
  const initial = (user?.full_name || user?.email || "V").trim().slice(0, 1).toUpperCase();

  useEffect(() => {
     if (!signed || !account?.state || account.authLoaded===false || !isAuthEntry(path)) return;
     void navigate({ to: accountHome(account.state), replace:true });
   }, [signed, account?.authLoaded, account?.state, path, navigate]);

  if (path.startsWith("/verify/")) return <>{children}</>;
   if (shouldHoldAuthEntryForHydration(path, account?.authLoaded, hasResolvedInitialAuth.current)) {
    return <SessionRestoreScreen />;
  }
  if (account?.loading && account.signedIn && !account.state) {
    return <SessionRestoreScreen />;
  }
  if (account?.signedIn && !account.state) return <div className="flex min-h-[100dvh] items-center justify-center p-6"><div className="vault-card max-w-sm p-6 text-center"><h1 className="text-xl font-bold">Your account could not be loaded</h1><p className="mt-2 text-sm text-muted-foreground">{account.error ?? "Please try again."}</p><button className="btn-primary mt-5 w-full" onClick={() => void account.refresh().catch(() => {})}>Retry</button></div></div>;
  if (!account && !vault.hydrated) return <div className="min-h-[100dvh] bg-slate-950" />;
  if (account && !signed && isPublic) return <>{children}</>;
   if (account && !signed && !isPublic && !isWorkshopTerminal) {
    return <div className="flex min-h-[100dvh] items-center justify-center p-6"><div className="vault-card max-w-sm p-6 text-center"><ShieldCheck className="mx-auto h-8 w-8 text-primary" /><h1 className="mt-3 text-xl font-bold">Sign in to V5Vault</h1><p className="mt-2 text-sm text-muted-foreground">Your vehicle records belong to your account, not this device.</p><a href="/sign-in" className="btn-primary mt-5 w-full">Continue to sign in</a></div></div>;
  }
  if (signed && isPublic && !isAuthEntry(path)) return <>{children}</>;
  if (signed && isPublic) return <div className="min-h-[100dvh] bg-slate-950" />;
  if (!account && isPublic) return <>{children}</>;
  if (!account && (!vault.unlocked || !vault.pin)) return <UnlockGate />;

  const doRole = async (r: Role) => {
    if (!account) { vault.setRole(r); return; }
    setWorking(true);
    try { await account.switchRole(r); await navigate({to:r==="superadmin"&&user?.role==="dev_admin"?"/admin":r==="Garage"?"/garage":"/vehicle"}); toast.success("View updated"); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Role could not be changed"); }
    finally { setWorking(false); }
  };
  return (
    <div data-view-mode={account?.displayPreference ?? "easy"} className="app-viewport flex h-[100dvh] min-h-[100dvh] w-full flex-col overflow-hidden bg-slate-950 animate-vault-open">
      <header className="sticky top-0 z-30 grid h-14 w-full shrink-0 grid-cols-[20%_60%_20%] items-center border-b border-slate-800 bg-slate-900 px-4 print:hidden">
        <div className="flex min-w-0 items-center justify-start">
          <Link to="/vehicle" className="flex h-11 w-11 shrink-0 items-center justify-center bg-transparent p-0.5 transition-opacity hover:opacity-80" aria-label="V5Vault home">
            <V5VaultLogo className="h-10 w-10" />
          </Link>
        </div>
        <div className="flex min-w-0 items-center justify-center">
          {isWorkshopTerminal || isWorkshopMode ? <div className="flex min-h-10 max-w-full items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-950/40 px-3 text-xs font-semibold text-emerald-200">
            {user?.garage_logo_url ? <img src={user.garage_logo_url} alt="" referrerPolicy="no-referrer" className="h-5 w-5 shrink-0 rounded object-contain" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : <Wrench className="h-4 w-4 shrink-0 text-emerald-400" />}
            <span className="truncate">{user?.garage_name || "Verified Workshop"}</span>
          </div> : <DropdownMenu>
            <DropdownMenuTrigger className="flex min-h-[40px] max-w-[min(calc(100vw-8rem),24rem)] min-w-0 items-center justify-center gap-1.5 rounded-full border border-slate-700/60 bg-slate-800/60 px-3.5 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800">
              <span className="min-w-0 truncate">{active ? `${active.make} ${active.model.split(" ")[0]} – ${formatVrm(active.vrm)}` : "Connect a vehicle"}</span><ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-64">
              <DropdownMenuLabel>Your vehicles</DropdownMenuLabel>
              {vehicles.map((v) => <DropdownMenuItem key={v.vrm} onClick={() => { vault.setActiveVrm(v.vrm); void navigate({ to: "/vehicle" }); }}>{v.make} {v.model} – {formatVrm(v.vrm)}{v.status === "pending" ? " · pending" : ""}</DropdownMenuItem>)}
              {!vehicles.length && <p className="px-2 py-2 text-xs text-muted-foreground">No linked vehicles yet.</p>}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setConnectOpen(true)}><Car className="h-4 w-4" /> Connect New Vehicle</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>}
        </div>
        <div className="flex min-w-0 items-center justify-end">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-full p-1.5 transition-transform hover:bg-slate-800/50 active:scale-95" aria-label="Open profile menu">
              <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-cyan-400 bg-slate-800 text-[11px] font-bold text-cyan-300">{initial}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuLabel className="flex flex-col items-start gap-1">
                <span className="max-w-full truncate text-sm">{user?.full_name || user?.email || "Account"}</span>
                 <span className="rounded-md border border-cyan-500/30 bg-cyan-950/80 px-2 py-1 font-mono text-[11px] text-cyan-300">{user?.role==="dev_admin"?"SuperAdmin / God Mode":ROLE_NAME[role]}</span>
                 {user?.role==="dev_admin"&&role!=="superadmin"&&<span className="text-[10px] text-muted-foreground">Viewing: {ROLE_LABELS[role]}</span>}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {!!account?.state?.notifications.some((n) => !n.read) && <DropdownMenuItem onClick={async () => { if (!account) return; try { await account.markRead(); toast.success("Notifications marked as read"); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not update notifications"); } }}><Bell className="h-4 w-4" /> Mark notifications read</DropdownMenuItem>}
              {(account?.state?.notifications ?? []).slice(0, 4).map((n) => <div key={n.id} className={`px-2 py-2 text-xs leading-relaxed ${n.read ? "text-muted-foreground" : "text-foreground"}`}>{n.message}{!n.read && <span className="ml-2 inline-block h-1.5 w-1.5 rounded-full bg-primary" />}</div>)}
               {(account?.state?.development||user?.role==="dev_admin") && <>
                <DropdownMenuSeparator />
                 <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">{user?.role==="dev_admin"?"Tier view switcher":"Development role switch"}</DropdownMenuLabel>
                {ROLES.map((r) => <DropdownMenuItem key={r} disabled={working} onClick={() => void doRole(r)}>{ROLE_LABELS[r]}{r === role ? " · Active" : ""}</DropdownMenuItem>)}
              </>}
               {user?.role==="dev_admin"&&<>
                 <DropdownMenuSeparator />
                 <DropdownMenuItem onClick={()=>void navigate({to:"/bookings"})}>Workshop bookings</DropdownMenuItem>
                 <DropdownMenuItem onClick={()=>void navigate({to:"/queue"})}>Customer queue</DropdownMenuItem>
                 <DropdownMenuItem onClick={()=>void navigate({to:"/settings"})}>Account & settings</DropdownMenuItem>
               </>}
              <DropdownMenuSeparator />
               <DropdownMenuItem onClick={async () => { try { if (account) await account.signOut(); else vault.lock(); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not sign out"); } }}><LogOut className="h-4 w-4" /> {account?.preview?"Exit sample preview":"Sign out"}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>
      {signed && isDeveloper && <div role="group" aria-label="Terminal and owner mode" className="flex shrink-0 items-center justify-center gap-2 border-b border-slate-800 bg-slate-900/80 px-4 py-2 print:hidden">
        <button type="button" aria-pressed={isWorkshopTerminal} onClick={() => void navigate({ to: "/garage" })} className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-3 text-xs font-semibold ${isWorkshopTerminal ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300" : "border-slate-700 text-slate-300"}`}><Wrench className="h-4 w-4" />Terminal</button>
        <span aria-hidden="true" className="text-slate-600">↔</span>
        <button type="button" aria-pressed="false" onClick={() => void navigate({ to: "/vehicle" })} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-700 px-3 text-xs font-semibold text-slate-300"><Car className="h-4 w-4" />Owner</button>
      </div>}
      {account?.preview&&<div className="flex shrink-0 items-center justify-between gap-3 border-b border-amber-500/25 bg-amber-950/40 px-4 py-2 text-[11px] text-amber-100">
        <span>Sample God Mode · No real account or database access. Changes reset on reload.</span>
        <button type="button" onClick={()=>void account.signOut()} className="min-h-9 shrink-0 rounded-lg border border-amber-500/30 px-2">Exit preview</button>
      </div>}
      {account?.error && <div role="alert" className="mx-auto mt-3 flex max-w-2xl items-center justify-between rounded-xl border border-red-500/30 bg-red-950/40 px-4 py-2 text-xs text-red-200"><span>{account.error}</span><button className="underline" onClick={() => void account.refresh().catch(() => {})}>Retry</button></div>}
       <main key={activeTab} className="mx-auto min-h-0 w-full max-w-2xl flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-4 pb-28 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4">
        {["/queue", "/bookings"].includes(path) && !garage ? <Navigate to="/garage" replace /> : signed && !garage && vehicles.length === 0 && ["/vehicle","/passport","/vault"].includes(path) ? <section className="vault-card mt-5 space-y-4 p-6 text-center"><Car className="mx-auto h-8 w-8 text-primary" /><h1 className="text-xl font-bold">Connect your first vehicle</h1><p className="mt-2 text-sm text-muted-foreground">Link a vehicle using its registration and 11-digit V5C reference. Development sample approvals are not live DVLA verification.</p><button className="btn-primary w-full" onClick={()=>setConnectOpen(true)}>Connect New Vehicle</button></section> : children}
      </main>
      {(!isWorkshopTerminal || garage) && <nav className="fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] inset-x-3 z-50 mx-auto flex max-w-md items-center justify-between rounded-2xl border border-slate-700/80 bg-slate-900/95 px-2 py-2 shadow-[0_10px_30px_rgba(0,0,0,0.8)] transform-gpu print:hidden">
        <div className="flex w-full justify-between">{navItems.map(({ to, label, icon: Icon }) => <Link key={to} to={to} activeOptions={{ exact: true }} className="group flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl border border-transparent px-1 py-1.5 text-center text-[9px] font-semibold leading-tight tracking-tight text-muted-foreground transition-colors data-[status=active]:border-cyan-500/30 data-[status=active]:bg-cyan-500/10 data-[status=active]:text-cyan-300 sm:text-[10px]"><Icon className="h-5 w-5 transition-transform group-data-[status=active]:scale-110" />{label}</Link>)}</div>
      </nav>}
      {account && <VehicleLookupDialog open={connectOpen} onOpenChange={setConnectOpen} />}
    </div>
  );
}

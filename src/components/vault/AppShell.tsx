import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Car, ChevronDown, FileBadge, Lock, LogOut, RefreshCcw, Terminal, TriangleAlert, Wrench } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ROLES, ROLE_LABELS, can, formatVrm, useVault, type Role } from "@/lib/vault-store";
import { V5VaultLogo } from "./V5VaultLogo";
import { UnlockGate } from "./UnlockGate";
import { VehicleLookupDialog } from "./VehicleLookupDialog";

const TABS = [
  { to: "/", label: "Vehicle", icon: Car },
  { to: "/vault", label: "Vault", icon: Lock },
  { to: "/garage", label: "Garage", icon: Wrench },
  { to: "/passport", label: "Passport", icon: FileBadge },
] as const;
const ADMIN_TAB = { to: "/admin", label: "Admin", icon: Terminal } as const;

const ROLE_MENU_DESCRIPTION: Record<Role, string> = {
  Owner: "Free Account",
  DIY: "Pro DIY",
  Pro: "Pro Modder",
  Garage: "Verified Garage Account",
  superadmin: "Dev SuperAdmin",
};

export function AppShell({ children }: { children: ReactNode }) {
  const { hydrated, unlocked, vehicle, vehicles, setActiveVrm, role, setRole, lock, pin, simulateTransfer } = useVault();
  const [transfer, setTransfer] = useState(false);
  const [addVehicleOpen, setAddVehicleOpen] = useState(false);
  const navigate = useNavigate();

  if (!hydrated) return <div className="min-h-screen" />;
  if (!unlocked || !pin) return <UnlockGate />;
  const tabs = can.admin(role) ? [...TABS, ADMIN_TAB] : TABS;

  return (
    <>
    <div className="app-viewport flex h-[100dvh] w-full flex-col overflow-hidden bg-slate-950 animate-vault-open">
      <header className="w-full h-14 px-4 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-30 print:hidden">
        <div className="flex min-w-0 justify-start items-center">
          <Link
            to="/"
            onClick={() => document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" })}
            className="shrink-0 p-1 hover:opacity-80 transition-opacity active:scale-95 flex items-center justify-center bg-transparent border-0"
            aria-label="V5Vault home — go to Vehicle overview"
            title="Return to Home Overview"
          >
            <V5VaultLogo className="h-10 w-10 text-cyan-400 drop-shadow-[0_0_10px_rgba(0,216,246,0.3)]" />
          </Link>
        </div>

        <div className="flex min-w-0 justify-center items-center">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex max-w-[min(calc(100vw-8rem),24rem)] min-w-0 items-center justify-center gap-1.5 rounded-full border border-slate-700/60 bg-slate-800/60 px-3.5 py-1.5 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800">
              <span className="min-w-0 truncate">
                {vehicle.make} {vehicle.model.split(" ")[0]} – {formatVrm(vehicle.vrm)}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center">
              <DropdownMenuLabel>Your vehicles</DropdownMenuLabel>
              {vehicles.map((v) => (
                <DropdownMenuItem key={v.vrm} onClick={() => setActiveVrm(v.vrm)}>
                  {v.make} {v.model} – {formatVrm(v.vrm)}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setAddVehicleOpen(true)}>
                <Car className="h-4 w-4" /> Add Vehicle
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex min-w-0 justify-end items-center">
          <DropdownMenu>
            <DropdownMenuTrigger
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full p-0 transition-transform active:scale-95"
              aria-label="Open Account Menu"
              title="Open Account Menu"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-cyan-400 bg-slate-800 text-xs font-bold text-cyan-400 shadow-md">
                JD
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="flex flex-col items-start gap-1 pb-2">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Account role</span>
                <span className="w-fit rounded-md border border-cyan-500/30 bg-cyan-950/80 px-2 py-1 font-mono text-xs tracking-wide text-cyan-400">
                  {ROLE_MENU_DESCRIPTION[role]}
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Switch Role</DropdownMenuLabel>
              {ROLES.map((r) => (
                <DropdownMenuItem key={r} onClick={() => setRole(r)}>
                  {ROLE_LABELS[r]} {r === role && "✓"}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setTransfer(true)} className="text-xs text-muted-foreground">
                <RefreshCcw className="h-4 w-4" /> Simulate DVLA Ownership Transfer
              </DropdownMenuItem>
              <DropdownMenuItem onClick={lock}>
                <LogOut className="h-4 w-4" /> Lock vault
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-24">{children}</main>

      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/90 backdrop-blur-md border-t border-slate-800 px-4 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] flex justify-around items-center print:hidden">
        <div className="flex w-full justify-between">
          {tabs.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: true }}
              className="group flex flex-col items-center gap-1 rounded-xl border border-transparent px-1 py-1.5 text-center text-[10px] font-semibold leading-tight tracking-tight text-muted-foreground transition-colors whitespace-nowrap data-[status=active]:border-cyan-500/30 data-[status=active]:bg-cyan-500/10 data-[status=active]:text-cyan-400"
            >
              <Icon className="h-5 w-5 transition-transform group-data-[status=active]:scale-110" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
      <VehicleLookupDialog open={addVehicleOpen} onOpenChange={setAddVehicleOpen} />

      <AlertDialog open={transfer} onOpenChange={setTransfer}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <TriangleAlert className="h-5 w-5 text-destructive" /> DVLA update detected
            </AlertDialogTitle>
            <AlertDialogDescription>
              A new V5C has been issued for this VIN. Your Vault Master PIN and biometrics will be wiped and this vehicle record locked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                simulateTransfer();
                navigate({ to: "/" });
              }}
            >
              Acknowledge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </>
  );
}

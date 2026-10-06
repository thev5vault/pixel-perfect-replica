import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Car, ChevronDown, FileBadge, Lock, LogOut, RefreshCcw, ShieldAlert, Terminal, Wrench } from "lucide-react";
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
import { ShieldLogo } from "./ui-bits";
import { UnlockGate } from "./UnlockGate";
import { VehicleLookupDialog } from "./VehicleLookupDialog";

const TABS = [
  { to: "/", label: "Vehicle", icon: Car },
  { to: "/vault", label: "Vault", icon: Lock },
  { to: "/garage", label: "Garage", icon: Wrench },
  { to: "/passport", label: "Passport", icon: FileBadge },
] as const;
const ADMIN_TAB = { to: "/admin", label: "Admin", icon: Terminal } as const;

const ROLE_BADGE: Record<Role, string> = { Owner: "Free", DIY: "DIY", Pro: "Pro", Garage: "Garage", superadmin: "Dev" };

export function AppShell({ children }: { children: ReactNode }) {
  const { hydrated, unlocked, vehicle, vehicles, setActiveVrm, role, setRole, lock, pin, simulateTransfer } = useVault();
  const [transfer, setTransfer] = useState(false);
  const [addVehicleOpen, setAddVehicleOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const isTextField = (target: EventTarget | null): target is HTMLElement =>
      target instanceof HTMLElement && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
    const handleFocusIn = (event: FocusEvent) => {
      if (isTextField(event.target)) setIsTyping(true);
    };
    const handleFocusOut = (event: FocusEvent) => {
      if (!isTextField(event.relatedTarget)) setIsTyping(false);
    };
    window.addEventListener("focusin", handleFocusIn);
    window.addEventListener("focusout", handleFocusOut);
    return () => {
      window.removeEventListener("focusin", handleFocusIn);
      window.removeEventListener("focusout", handleFocusOut);
    };
  }, []);

  if (!hydrated) return <div className="min-h-screen" />;
  if (!unlocked || !pin) return <UnlockGate />;
  const tabs = can.admin(role) ? [...TABS, ADMIN_TAB] : TABS;

  return (
    <div className="app-viewport flex h-[100dvh] w-full flex-col overflow-hidden bg-slate-950 animate-vault-open">
      <header className="shrink-0 z-40 bg-slate-900 border-b border-slate-800/80 px-4 py-3 flex justify-between items-center transform-gpu print:hidden">
        <div className="mx-auto flex w-full max-w-2xl items-center gap-3">
          <Link to="/" className="flex items-center gap-1.5" aria-label="V5Vault home">
            <ShieldLogo className="h-7 w-7" />
            <span className="hidden font-display text-lg font-bold sm:inline">V5Vault</span>
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border bg-card px-3 py-1.5 text-sm font-semibold">
              <span className="truncate">
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

          <DropdownMenu>
            <DropdownMenuTrigger className="relative" aria-label="Profile">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20 font-display text-sm font-bold text-primary ring-2 ring-primary/40">
                JD
              </span>
              <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-primary px-1.5 text-[9px] font-bold uppercase text-primary-foreground">
                {ROLE_BADGE[role]}
              </span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
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

      <main className="mx-auto w-full max-w-2xl min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-44">{children}</main>

      <nav className={`${isTyping ? "hidden" : "fixed bottom-4 inset-x-3 max-w-md mx-auto z-50 bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.8)] px-2 py-2 flex justify-between items-center transform-gpu"} print:hidden`}>
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
              <ShieldAlert className="h-5 w-5 text-destructive" /> DVLA update detected
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
  );
}

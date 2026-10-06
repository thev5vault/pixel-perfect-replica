import { useState, type ReactNode } from "react";
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

const TABS = [
  { to: "/", label: "My Vehicle", icon: Car },
  { to: "/vault", label: "The Vault", icon: Lock },
  { to: "/garage", label: "Garage Portal", icon: Wrench },
  { to: "/passport", label: "Export Passport", icon: FileBadge },
] as const;
const ADMIN_TAB = { to: "/admin", label: "Admin Console", icon: Terminal } as const;

const ROLE_BADGE: Record<Role, string> = { Owner: "Free", DIY: "DIY", Pro: "Pro", Garage: "Garage", superadmin: "Dev" };

export function AppShell({ children }: { children: ReactNode }) {
  const { hydrated, unlocked, vehicle, vehicles, setActiveVrm, role, setRole, lock, pin, simulateTransfer } = useVault();
  const [transfer, setTransfer] = useState(false);
  const navigate = useNavigate();

  if (!hydrated) return <div className="min-h-screen" />;
  if (!unlocked || !pin) return <UnlockGate />;
  const tabs = can.admin(role) ? [...TABS, ADMIN_TAB] : TABS;

  return (
    <div className="flex min-h-[100dvh] w-full flex-col justify-between overflow-x-clip bg-background animate-vault-open">
      <header className="sticky top-0 flex-none z-40 border-b bg-background/85 backdrop-blur-lg">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
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
              <DropdownMenuItem onClick={lock}>
                <Lock className="h-4 w-4" /> Add another vehicle
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

      <main className="mx-auto w-full max-w-2xl flex-1 px-4 pt-5 pb-32">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 px-4 pt-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-md">
        <div className="mx-auto grid max-w-2xl" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}>
          {tabs.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: true }}
              className="group flex flex-col items-center gap-1 py-1.5 text-center text-[11px] font-semibold leading-tight text-muted-foreground transition-colors data-[status=active]:text-primary"
            >
              <Icon className="h-5 w-5 transition-transform group-data-[status=active]:scale-110" />
              {label}
            </Link>
          ))}
        </div>
      </nav>

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

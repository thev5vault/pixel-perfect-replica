import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Car, ChevronDown, FileBadge, Lock, LogOut, Wrench } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatVrm, useVault, type Role } from "@/lib/vault-store";
import { ShieldLogo } from "./ui-bits";
import { UnlockGate } from "./UnlockGate";

const TABS = [
  { to: "/", label: "My Vehicle", icon: Car },
  { to: "/vault", label: "The Vault", icon: Lock },
  { to: "/garage", label: "Garage Portal", icon: Wrench },
  { to: "/passport", label: "Export Passport", icon: FileBadge },
] as const;

const ROLES: Role[] = ["Owner", "Pro", "Garage"];
const ROLE_LABELS: Record<Role, string> = {
  Owner: "Everyday Driver",
  Pro: "Pro Modder",
  Garage: "Garage",
};

export function AppShell({ children }: { children: ReactNode }) {
  const { hydrated, unlocked, vehicle, vehicles, setActiveVrm, role, setRole, lock } = useVault();

  if (!hydrated) return <div className="min-h-screen" />;
  if (!unlocked) return <UnlockGate />;

  return (
    <div className="min-h-screen animate-vault-open">
      <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-lg">
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
                {role}
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
              <DropdownMenuItem onClick={lock}>
                <LogOut className="h-4 w-4" /> Lock vault
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 pb-20 pt-5">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg">
        <div className="mx-auto grid max-w-2xl grid-cols-4">
          {TABS.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: true }}
              className="group flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold text-muted-foreground transition-colors data-[status=active]:text-primary"
            >
              <Icon className="h-5 w-5 transition-transform group-data-[status=active]:scale-110" />
              {label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

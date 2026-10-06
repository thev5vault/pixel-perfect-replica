import type React from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import receiptService from "@/assets/receipt-service.jpg";
import receiptBrakes from "@/assets/receipt-brakes.jpg";
import dynoSheet from "@/assets/dyno-sheet.jpg";

export type ServiceCategory = "Servicing" | "Brakes" | "Repairs" | "Tyres";
export type ModCategory = "Engine/ECU" | "Exhaust" | "Intake" | "Suspension" | "Brakes" | "Visual";
export type Role = "Owner" | "DIY" | "Pro" | "Garage" | "superadmin";

export const ROLES: Role[] = ["Owner", "DIY", "Pro", "Garage", "superadmin"];
export const ROLE_LABELS: Record<Role, string> = {
  Owner: "Basic Driver (Free)",
  DIY: "Pro DIY (£0.99/mo)",
  Pro: "Pro Modder (£1.99/mo)",
  Garage: "Verified Garage (£7.99/mo)",
  superadmin: "Dev Owner / SuperAdmin (God Mode)",
};
/** Feature entitlements per tier. Pro Modder and Garage include Pro DIY features. */
export const can = {
  diy: (r: Role) => r !== "Owner",
  vault: (r: Role) => r === "Pro" || r === "superadmin",
  garage: (r: Role) => r === "Garage" || r === "superadmin",
  admin: (r: Role) => r === "superadmin",
};

export interface PartLine {
  name: string;
  partNo: string;
}

export interface ServiceRecord {
  id: string;
  vrm: string;
  date: string; // ISO yyyy-mm-dd
  mileage: number;
  category: ServiceCategory;
  description: string;
  items: string[];
  cost?: number | undefined;
  garage: string;
  verified: boolean;
  tier3?: boolean | undefined;
  image?: string | undefined;
  parts?: PartLine[] | undefined;
  fluids?: string | undefined;
  partsCost?: number | undefined;
  labourCost?: number | undefined;
}

export interface Modification {
  id: string;
  vrm: string;
  name: string;
  category: ModCategory;
  installDate: string;
  installMileage: number;
  gains: string;
  notes: string;
  image?: string | undefined;
  status: "active" | "reverted";
  stage?: string | undefined;
  specs?: string | undefined;
  tags?: string[] | undefined;
  removalDate?: string;
  removalMileage?: number;
}

export interface Vehicle {
  vrm: string;
  make: string;
  model: string;
  odometer: number;
  v5cDate: string;
  motExpiry: string;
}

export const SERVICE_CATEGORIES: ServiceCategory[] = ["Servicing", "Brakes", "Repairs", "Tyres"];
export const MOD_CATEGORIES: ModCategory[] = ["Engine/ECU", "Exhaust", "Intake", "Suspension", "Brakes", "Visual"];

const VEHICLES: Vehicle[] = [
  { vrm: "AB14CDE", make: "Audi", model: "A4 2.0 TDI", odometer: 87420, v5cDate: "2019-03-15", motExpiry: "2026-11-18" },
];

const SEED_SERVICES: ServiceRecord[] = [
  {
    id: "s1",
    vrm: "AB14CDE",
    date: "2024-09-12",
    mileage: 82100,
    category: "Servicing",
    description: "Full Service",
    items: ["Engine oil 5W-30 (5L)", "Oil filter", "Air filter", "Pollen filter", "Labour"],
    cost: 289,
    partsCost: 154,
    labourCost: 135,
    fluids: "Castrol Edge 5W-30 LL (VW 504.00/507.00), 4.6L",
    parts: [
      { name: "Oil filter", partNo: "Bosch F 026 407 183" },
      { name: "Air filter", partNo: "Mann C 30 005" },
      { name: "Pollen filter", partNo: "Febi Bilstein 26600" },
    ],
    garage: "Riverside Garage",
    verified: true,
    image: receiptService,
  },
  {
    id: "s2",
    vrm: "AB14CDE",
    date: "2025-03-08",
    mileage: 85340,
    category: "Brakes",
    description: "Brembo Brake Replacement",
    items: ["Brembo front discs (pair)", "Brembo front pads", "Brake fluid flush (DOT 4)", "Labour"],
    cost: 642,
    partsCost: 468,
    labourCost: 174,
    fluids: "Brembo LCF 600 Plus DOT 4, 1L",
    parts: [
      { name: "Front discs (pair)", partNo: "Brembo 09.C401.13" },
      { name: "Front pads", partNo: "Brembo P 85 153" },
    ],
    garage: "Apex Performance Ltd",
    verified: true,
    tier3: true,
    image: receiptBrakes,
  },
];

const SEED_MODS: Modification[] = [
  {
    id: "m1",
    vrm: "AB14CDE",
    name: "Stage 2 ECU Remap",
    category: "Engine/ECU",
    installDate: "2024-11-02",
    installMileage: 83650,
    gains: "+53 bhp / +80 Nm",
    notes: "Custom map on 99 RON. Requires DPF-safe tune and uprated intercooler hoses.",
    image: dynoSheet,
    status: "active",
    stage: "Stage 2",
    specs: "99 RON map · DPF-safe · uprated intercooler hoses",
    tags: ["Tuned by Apex Performance", "Dyno verified"],
  },
  {
    id: "m2",
    vrm: "AB14CDE",
    name: "Ramair Cold Air Intake",
    category: "Intake",
    installDate: "2024-10-10",
    installMileage: 83020,
    gains: "+6 bhp",
    notes: "Removed due to intermittent MAF sensor fault (P0101).",
    status: "reverted",
    removalDate: "2024-12-20",
    removalMileage: 84100,
  },
];

interface Persisted {
  unlocked: boolean;
  services: ServiceRecord[];
  mods: Modification[];
  role: Role;
  activeVrm: string;
  v5cRefs: Record<string, string>;
  pin?: string | undefined;
  biometrics: boolean;
  notice?: string | undefined;
}

const KEY = "v5vault:v1";

interface VaultCtx extends Persisted {
  hydrated: boolean;
  vehicles: Vehicle[];
  vehicle: Vehicle;
  unlock: (vrm: string, ref: string) => boolean;
  setupSecurity: (pin: string, biometrics: boolean) => void;
  simulateTransfer: () => void;
  clearNotice: () => void;
  lock: () => void;
  setRole: (r: Role) => void;
  setActiveVrm: (v: string) => void;
  addService: (s: Omit<ServiceRecord, "id">) => boolean;
  addMod: (m: Omit<Modification, "id" | "status">) => void;
  revertMod: (id: string, date: string, mileage: number) => void;
}

// Keep one context instance across hot reloads so provider and consumers always match.
const g = globalThis as unknown as { __v5vaultCtx?: React.Context<VaultCtx | null> };
const Ctx = (g.__v5vaultCtx ??= createContext<VaultCtx | null>(null));

export const normalizeVrm = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, "");
export const formatVrm = (v: string) => {
  const n = normalizeVrm(v);
  return n.length > 4 ? `${n.slice(0, 4)} ${n.slice(4)}` : n;
};
const uid = () => Math.random().toString(36).slice(2, 10);

export function VaultProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [state, setState] = useState<Persisted>({
    unlocked: false,
    services: SEED_SERVICES,
    mods: SEED_MODS,
    role: "Owner",
    activeVrm: "AB14CDE",
    v5cRefs: { AB14CDE: "12345678901" },
    biometrics: false,
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setState((s) => ({ ...s, ...JSON.parse(raw) }));
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Storage full (large images) — keep state in memory only.
    }
  }, [state, hydrated]);

  const vehicle = VEHICLES.find((v) => v.vrm === state.activeVrm) ?? VEHICLES[0]!;

  const unlock = useCallback(
    (vrm: string, ref: string) => {
      const n = normalizeVrm(vrm);
      const ok = VEHICLES.some((v) => v.vrm === n) && state.v5cRefs[n] === ref.replace(/\D/g, "");
      if (ok) setState((s) => ({ ...s, unlocked: true, activeVrm: n, notice: undefined }));
      return ok;
    },
    [state.v5cRefs],
  );

  const value = useMemo<VaultCtx>(
    () => ({
      ...state,
      hydrated,
      vehicles: VEHICLES,
      vehicle,
      unlock,
      setupSecurity: (pin, biometrics) => setState((s) => ({ ...s, pin, biometrics })),
      simulateTransfer: () =>
        setState((s) => ({
          ...s,
          unlocked: false,
          pin: undefined,
          biometrics: false,
          v5cRefs: { ...s.v5cRefs, [s.activeVrm]: String(Math.floor(1e10 + Math.random() * 9e10)) },
          notice: "Ownership transfer detected. This vehicle has been unlinked from your account.",
        })),
      clearNotice: () => setState((s) => ({ ...s, notice: undefined })),
      lock: () => setState((s) => ({ ...s, unlocked: false })),
      setRole: (role) => setState((s) => ({ ...s, role })),
      setActiveVrm: (activeVrm) => setState((s) => ({ ...s, activeVrm })),
      addService: (rec) => {
        const vrm = normalizeVrm(rec.vrm);
        if (!VEHICLES.some((v) => v.vrm === vrm)) return false;
        setState((s) => ({ ...s, services: [...s.services, { ...rec, vrm, id: uid() }] }));
        return true;
      },
      addMod: (m) => setState((s) => ({ ...s, mods: [...s.mods, { ...m, id: uid(), status: "active" }] })),
      revertMod: (id, removalDate, removalMileage) =>
        setState((s) => ({
          ...s,
          mods: s.mods.map((m) => (m.id === id ? { ...m, status: "reverted", removalDate, removalMileage } : m)),
        })),
    }),
    [state, hydrated, vehicle, unlock],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useVault() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useVault must be used within VaultProvider");
  return c;
}

export function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 1200;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = img.width * scale;
      c.height = img.height * scale;
      c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", 0.75));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export const fmtDate = (iso: string) =>
  new Date(iso + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
export const fmtMiles = (n: number) => `${n.toLocaleString("en-GB")} mi`;
export const today = () => new Date().toISOString().slice(0, 10);

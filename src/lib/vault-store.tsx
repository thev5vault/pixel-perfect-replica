import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import receiptService from "@/assets/receipt-service.jpg";
import receiptBrakes from "@/assets/receipt-brakes.jpg";
import dynoSheet from "@/assets/dyno-sheet.jpg";

export type ServiceCategory = "Servicing" | "Brakes" | "Repairs" | "Tyres";
export type ModCategory = "Engine/ECU" | "Exhaust" | "Intake" | "Suspension" | "Brakes" | "Visual";
export type Role = "Owner" | "Pro" | "Garage";

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
    garage: "Apex Performance Ltd",
    verified: true,
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
}

const KEY = "v5vault:v1";

interface VaultCtx extends Persisted {
  hydrated: boolean;
  vehicles: Vehicle[];
  vehicle: Vehicle;
  unlock: (vrm: string, date: string) => boolean;
  lock: () => void;
  setRole: (r: Role) => void;
  setActiveVrm: (v: string) => void;
  addService: (s: Omit<ServiceRecord, "id">) => boolean;
  addMod: (m: Omit<Modification, "id" | "status">) => void;
  revertMod: (id: string, date: string, mileage: number) => void;
}

const Ctx = createContext<VaultCtx | null>(null);

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

  const unlock = useCallback((vrm: string, date: string) => {
    const match = VEHICLES.find((v) => v.vrm === normalizeVrm(vrm) && v.v5cDate === date);
    if (match) setState((s) => ({ ...s, unlocked: true, activeVrm: match.vrm }));
    return !!match;
  }, []);

  const value = useMemo<VaultCtx>(
    () => ({
      ...state,
      hydrated,
      vehicles: VEHICLES,
      vehicle,
      unlock,
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

import type { Modification, ServiceRecord, Vehicle } from "./vault-store";

export type AccountRole = "civilian" | "modder" | "verified_garage";
export type SubscriptionTier = "free" | "pro_diy" | "pro_modder" | "verified_garage";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export interface UserAccount {
  id: string;
  email: string;
  full_name: string;
  role: AccountRole;
  subscription_tier: SubscriptionTier;
  stripe_customer_id: string | null;
  created_at: string;
  garage_verified: boolean;
  garage_name: string;
  garage_registration: string;
  status: ApprovalStatus;
  is_sample: boolean;
}
export interface AccountNotification { id: string; message: string; read: boolean; created_at: string }
export interface Booking { id: string; vrm: string; date: string; notes: string; status: "booked" | "completed" | "cancelled" }
export interface AccountState {
  user: UserAccount;
  vehicles: Vehicle[];
  services: ServiceRecord[];
  mods: Modification[];
  notifications: AccountNotification[];
  bookings: Booking[];
  development: boolean;
  development_role: import("./vault-store").Role | null;
}

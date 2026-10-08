import type { Modification, ServiceRecord, Vehicle } from "./vault-store";

export type AccountRole = "civilian" | "modder" | "verified_garage" | "dev_admin";
export type SubscriptionTier = "free" | "pro_diy" | "pro_modder" | "verified_garage" | "god_mode";
export const ADMIN_PERMISSIONS = ["all_access", "approve_garages", "view_all_users", "edit_vehicles", "stamp_all_workshops"] as const;
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
  vat_verified?: boolean;
  email_verified?: boolean;
  billing_unavailable?: boolean;
  garage_name: string;
  garage_registration: string;
  status: ApprovalStatus;
  is_sample: boolean;
  permissions?: readonly string[];
  workshop_type?: "garage" | "specialist";
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
export type AdminUser = Pick<UserAccount, "id" | "email" | "full_name" | "role" | "subscription_tier" | "status" | "is_sample" | "garage_name" | "garage_registration" | "garage_verified" | "created_at" | "workshop_type">;
export interface AdminState {
  users: AdminUser[];
  vehicles: Vehicle[];
  applications: AdminUser[];
}
export interface AdminVehicleEdit { vrm: string; make: string; model: string; odometer: number; is_scrapped?: boolean | undefined }
export interface WorkshopReview { id: string; status: "approved" | "rejected"; vat_verified?: boolean | undefined }

import type { Vehicle, ServiceRecord, Modification, MotReading } from "./vault-store";

export type PlanKey = "sales_pack" | "diy_monthly" | "pro_monthly" | "pro_yearly" | "workshop_monthly";
export interface BillingPrice { key: PlanKey; name: string; amount_pence: number; currency: "gbp"; interval: "month" | "year" | null; price_id: string; }
export interface BillingCatalog { prices: BillingPrice[]; test_mode: boolean; }
export interface CheckoutResult { url: string | null; preview: boolean; message: string; }
export interface PdfDownload { filename: string; base64: string; }
export interface PublicPassport {
  vehicle: Vehicle;
  services: ServiceRecord[];
  mods: Modification[];
  mot_history: MotReading[];
  verified_stamp_count: number;
  generated_at: string;
  public_url: string;
  is_sample: boolean;
  published: boolean;
}
export interface InvestorMetrics {
  total_registered_users: number;
  active_passports: number;
  garage_adoption: number;
  paying_accounts: number;
  mrr_pence: number;
  projected_mrr_pence: number;
  pending_workshops: number;
  as_of: string;
  is_sample: boolean;
}
export interface ReminderPreferences { email: boolean; sms: boolean; phone: string; }
export interface ReminderItem {
  vrm: string;
  kind: "mot" | "service";
  due_date: string;
  customer_label: string;
  email_allowed: boolean;
  sms_allowed: boolean;
  email_available: boolean;
  sms_available: boolean;
  last_sent_at: string | null;
  is_sample: boolean;
}
export interface ReminderResult { status: "queued" | "simulated"; message: string; }
export interface PendingOwnershipClaim {
  id: string; vrm: string; applicant_name: string; applicant_email: string;
  vin: string; created_at: string; is_sample: boolean; status: string;
}

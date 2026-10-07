import { useMemo } from "react";
import { useAccount } from "./account-store";
import { PLAN_DEFINITIONS, PLAN_KEYS } from "./plans";
import { passportData } from "./passport-data";
import type { BillingCatalog, InvestorMetrics, PlanKey, ReminderPreferences } from "./v1-types";
import * as api from "@/services/v1Api";

export function savePdf(file: { filename: string; base64: string }) {
  const bytes = Uint8Array.from(atob(file.base64), c => c.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
  const link = document.createElement("a"); link.href = url; link.download = file.filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const previewPreferences: ReminderPreferences = { email: false, sms: false, phone: "" };
export function useV1() {
  const account = useAccount();
  return useMemo(() => {
    const preview = Boolean(account?.preview && import.meta.env.DEV);
    const snapshot = (vrm: string) => {
      const state = account?.state, vehicle = state?.vehicles.find(v => v.vrm === vrm);
      if (!vehicle || !state) throw new Error("Select a linked vehicle first.");
      return passportData(vehicle, state.services.filter(s => s.vrm === vrm), state.mods.filter(m => m.vrm === vrm), window.location.origin, true);
    };
    const sampleMetrics = async (): Promise<InvestorMetrics> => {
      const state = await account!.getAdminState();
      return { total_registered_users: state.users.length, active_passports: state.vehicles.length,
        garage_adoption: state.users.filter(u => u.garage_verified && u.role === "verified_garage").length,
        pending_workshops: state.applications.length, paying_accounts: 0, mrr_pence: 0, projected_mrr_pence: 0,
        as_of: new Date().toISOString(), is_sample: true };
    };
    const logo = async () => { const response = await fetch("/logo.png"); return response.ok ? new Uint8Array(await response.arrayBuffer()) : undefined; };
    return {
      preview,
      getCatalog: async (): Promise<BillingCatalog> => preview ? { test_mode: true, prices: PLAN_KEYS.map(key => ({
        key, name: PLAN_DEFINITIONS[key].name, amount_pence: PLAN_DEFINITIONS[key].amount, currency: "gbp",
        interval: PLAN_DEFINITIONS[key].interval, price_id: `sample_${key}`,
      })) } : api.getBillingCatalog(),
      checkout: async (plan: PlanKey, vrm?: string) => {
        if (preview) {
          if (plan !== "sales_pack") await account?.switchRole(plan === "workshop_monthly" ? "Garage" : plan === "diy_monthly" ? "DIY" : "Pro");
          return { url: null, preview: true, message: "Sample plan preview opened. No payment was taken." };
        }
        return api.startCheckout({ data: { plan, vrm } });
      },
      confirmCheckout: async (session_id: string) => {
        if (preview) return { fulfilled: false, message: "Sample previews do not create Stripe purchases." };
        const result = await api.confirmCheckout({ data: { session_id } }); await account?.refresh(); return result;
      },
      billingPortal: async () => preview ? { url: null, preview: true, message: "No billing customer exists in sample preview." } : api.openBillingPortal(),
      getPublicPassport: async (vrm: string, sample = false) => preview ? snapshot(vrm) : api.getPublicPassport({ data: { vrm, sample } }),
      setSharing: async (vrm: string, enabled: boolean) => {
        if (preview) return { enabled, message: "Sample sharing preview only. No live vehicle was published." };
        const result = await api.setPassportSharing({ data: { vrm, enabled } }); await account?.refresh(); return result;
      },
      salesPdf: async (vrm: string) => preview ? (await import("./pdf-reports")).salesReportPdf(snapshot(vrm), await logo()) : api.downloadSalesPdf({ data: { vrm } }),
      getMetrics: async () => preview ? sampleMetrics() : api.getInvestorMetrics(),
      grantPdf: async () => preview ? (await import("./pdf-reports")).investorReportPdf(await sampleMetrics(), await logo()) : api.downloadGrantPdf(),
      getReminders: async () => preview ? [] : api.getCustomerReminders(),
      sendReminder: async (input: Parameters<typeof api.sendCustomerReminder>[0]["data"]) => preview
        ? { status: "simulated" as const, message: "Sample reminder simulated. No SMS or email was sent." } : api.sendCustomerReminder({ data: input }),
      getPreferences: async () => preview ? { ...previewPreferences } : api.getReminderPreferences(),
      savePreferences: async (data: ReminderPreferences) => {
        if (preview) { Object.assign(previewPreferences, data); return { ok: true }; }
        return api.saveReminderPreferences({ data });
      },
      getPendingClaims: async () => preview ? [] : api.getPendingOwnershipClaims(),
      reviewClaim: async (input: Parameters<typeof api.reviewOwnershipClaim>[0]["data"]) => {
        if (preview) return { ok: true };
        const result = await api.reviewOwnershipClaim({ data: input }); await account?.refresh(); return result;
      },
      refreshVehicle: async (vrm: string) => {
        if (preview) return { ok: true, message: "This is sample data. No official lookup was requested." };
        const result = await api.refreshOfficialVehicle({ data: { vrm } }); await account?.refresh(); return result;
      },
    };
  }, [account]);
}

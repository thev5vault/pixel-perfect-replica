import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { InvestorMetricsPanel } from "@/components/vault/InvestorMetricsPanel";
import { OwnershipClaimsPanel } from "@/components/vault/OwnershipClaimsPanel";
import { VehicleVerificationRequestsPanel } from "@/components/vault/VehicleVerificationRequestsPanel";
import {
  AlertCircle,
  BadgeCheck,
  Building2,
  CarFront,
  Check,
  ChevronDown,
  Clock3,
  LoaderCircle,
  RefreshCw,
  Users,
  Wrench,
  X,
} from "lucide-react";
import { PageHeader, Pill, Plate } from "@/components/vault/ui-bits";
import type { AdminState, AdminUser } from "@/lib/account-types";
import { useAccount } from "@/lib/account-store";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Admin Console — V5Vault" },
      { name: "description", content: "Manage V5Vault accounts, workshops and vehicle records." },
      { property: "og:title", content: "Admin Console — V5Vault" },
      { property: "og:description", content: "Manage V5Vault accounts, workshops and vehicle records." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const account = useAccount();
  const [adminData, setAdminData] = useState<AdminState | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [savingVrm, setSavingVrm] = useState<string | null>(null);
  const [editingVrm, setEditingVrm] = useState<string | null>(null);
  const [draftMake, setDraftMake] = useState("");
  const [draftModel, setDraftModel] = useState("");
  const [draftOdometer, setDraftOdometer] = useState("");
  const [draftScrapped, setDraftScrapped] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [tierSearch, setTierSearch] = useState("");
  const [adminActionId, setAdminActionId] = useState<string | null>(null);
  const getAdminStateRef = useRef(account?.getAdminState);
  const reviewWorkshopRef = useRef(account?.reviewWorkshop);
  const editVehicleRef = useRef(account?.editVehicle);
  const grantTierOverrideRef = useRef(account?.grantTierOverride);
  const revokeTierOverrideRef = useRef(account?.revokeTierOverride);
  const extendWorkshopTrialRef = useRef(account?.extendWorkshopTrial);
  getAdminStateRef.current = account?.getAdminState;
  reviewWorkshopRef.current = account?.reviewWorkshop;
  editVehicleRef.current = account?.editVehicle;
  grantTierOverrideRef.current = account?.grantTierOverride;
  revokeTierOverrideRef.current = account?.revokeTierOverride;
  extendWorkshopTrialRef.current = account?.extendWorkshopTrial;

  const isAdmin = account?.state?.user.role === "dev_admin";
  const userId = account?.state?.user.id;

  useEffect(() => {
    if (!isAdmin || account?.loading || account?.error) return;
    let active = true;
    setDataLoading(true);
    setDataError(null);
    const load = getAdminStateRef.current;
    if (!load) {
      setDataError("Admin data is not available.");
      setDataLoading(false);
      return;
    }
    void load()
      .then((result) => {
        if (active) setAdminData(result);
      })
      .catch((error: unknown) => {
        if (active) setDataError(error instanceof Error ? error.message : "Admin data could not be loaded.");
      })
      .finally(() => {
        if (active) setDataLoading(false);
      });
    return () => {
      active = false;
    };
  }, [isAdmin, userId, account?.loading, account?.error, reloadKey]);

  const refreshAdminData = () => setReloadKey((key) => key + 1);

  const reviewApplication = async (user: AdminUser, status: "approved" | "rejected") => {
    const review = reviewWorkshopRef.current;
    if (!review || reviewingId) return;
    setActionError(null);
    setReviewingId(user.id);
    try {
      if(status==="approved"&&!account?.preview&&!window.confirm("I have checked the workshop's VAT registration and business identity using supporting evidence. Confirm VAT verification and approve?")) return;
      await review({ id: user.id, status,vat_verified:status==="approved" });
      const load = getAdminStateRef.current;
      if (!load) throw new Error("Admin data is not available.");
      setAdminData(await load());
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Workshop application could not be updated.");
    } finally {
      setReviewingId(null);
    }
  };

  const changeTierOverride = async (user: AdminUser) => {
    const change = user.tier_override === "pro_modder_lifetime"
      ? revokeTierOverrideRef.current
      : grantTierOverrideRef.current;
    if (!change || adminActionId) return;
    setActionError(null);
    setActionNotice(null);
    setAdminActionId(user.id);
    try {
      await change(user.id);
      const load = getAdminStateRef.current;
      if (!load) throw new Error("Admin data is not available.");
      setAdminData(await load());
      setActionNotice(user.tier_override === "pro_modder_lifetime"
        ? `Lifetime Pro Modder access revoked for ${user.email}.`
        : `Lifetime Pro Modder access granted to ${user.email}.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The tier override could not be updated.");
    } finally {
      setAdminActionId(null);
    }
  };

  const extendTrial = async (user: AdminUser) => {
    const extend = extendWorkshopTrialRef.current;
    if (!extend || adminActionId) return;
    setActionError(null);
    setActionNotice(null);
    setAdminActionId(user.id);
    try {
      await extend(user.id);
      const load = getAdminStateRef.current;
      if (!load) throw new Error("Admin data is not available.");
      setAdminData(await load());
      setActionNotice(`Workshop trial extended by 30 days for ${user.email}.`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "The workshop trial could not be extended.");
    } finally {
      setAdminActionId(null);
    }
  };

  const startEditing = (vehicle: AdminState["vehicles"][number]) => {
    setActionError(null);
    setEditingVrm(vehicle.vrm);
    setDraftMake(vehicle.make);
    setDraftModel(vehicle.model);
    setDraftOdometer(String(vehicle.odometer));
    setDraftScrapped(vehicle.is_scrapped === true);
  };

  const saveVehicle = async (event: FormEvent<HTMLFormElement>, vrm: string) => {
    event.preventDefault();
    const edit = editVehicleRef.current;
    const odometer = Number(draftOdometer);
    if (!draftMake.trim() || !draftModel.trim() || !Number.isFinite(odometer) || odometer < 0) {
      setActionError("Enter a make, model and valid non-negative odometer reading.");
      return;
    }
    if (!edit || savingVrm) return;
    setActionError(null);
    setSavingVrm(vrm);
    try {
      await edit({ vrm, make: draftMake.trim(), model: draftModel.trim(), odometer, is_scrapped: draftScrapped });
      const load = getAdminStateRef.current;
      if (!load) throw new Error("Admin data is not available.");
      setAdminData(await load());
      setEditingVrm(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Vehicle details could not be saved.");
    } finally {
      setSavingVrm(null);
    }
  };

  if (account?.loading) return <LoadingState label="Checking account access…" />;
  if (account?.error && !account.state) {
    return (
      <div className="space-y-4">
        <PageHeader title="Admin Console" subtitle="Account access could not be confirmed." />
        <Notice title="Account unavailable" message={account.error} />
        <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={() => void account.refresh().catch(() => undefined)}>
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    );
  }
  if (!account?.state) return <Notice title="SuperAdmin access required" message="Sign in with an authorized administrator account to view these records." />;

  // This guard intentionally uses the authenticated account role, never the development vault role.
  if (account.state.user.role !== "dev_admin") return <Notice title="SuperAdmin access required" message="Account administration is not unlocked by purchasing a plan or switching a development view." />;

  if (account.error) {
    return (
      <div className="space-y-4">
        <PageHeader title="Admin Console" subtitle="Account data needs attention before administration can continue." />
        <Notice title="Account could not be refreshed" message={account.error} />
        <button type="button" className="btn-primary inline-flex items-center gap-2" onClick={() => void account.refresh().catch(() => undefined)}>
          <RefreshCw className="h-4 w-4" /> Retry
        </button>
      </div>
    );
  }

  const preview = account.preview === true;
  const users = adminData?.users ?? [];
  const vehicles = adminData?.vehicles ?? [];
  const applications = adminData?.applications ?? [];
  const unlinkedVehicles = vehicles.filter((vehicle) => !users.some((user) => user.id === vehicle.owner_user_id));
  const tierMatches = tierSearch.trim()
    ? users.filter((user) => user.email.toLowerCase().includes(tierSearch.trim().toLowerCase())
      || user.id.toLowerCase().includes(tierSearch.trim().toLowerCase())).slice(0, 20)
    : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Console"
        subtitle="Account directory, workshop applications and vehicle record corrections."
      />
      {preview && (
        <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <p className="font-semibold">Sample preview — not live administration</p>
            <p className="mt-1 text-muted-foreground">
              The records and any approvals or vehicle edits here affect sample fixtures only. No real account or workshop record is changed.
            </p>
          </div>
        </div>
      )}
      {actionError && <Notice title="Action could not be completed" message={actionError} />}
      {actionNotice && <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{actionNotice}</p>}
      <InvestorMetricsPanel/>
      <OwnershipClaimsPanel/>
      <VehicleVerificationRequestsPanel/>

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Directory totals">
        <Summary icon={<Users className="h-5 w-5" />} label="Registered users" value={adminData ? users.length : null} />
        <Summary icon={<CarFront className="h-5 w-5" />} label="Vehicle records" value={adminData ? vehicles.length : null} />
        <Summary icon={<Clock3 className="h-5 w-5" />} label="Pending applications" value={adminData ? applications.length : null} />
      </section>

      {dataLoading && !adminData ? (
        <LoadingState label="Loading account and vehicle records…" />
      ) : dataError ? (
        <section className="vault-card p-5">
          <Notice title="Admin records unavailable" message={dataError} />
          <button type="button" onClick={refreshAdminData} className="btn-primary mt-4 inline-flex items-center gap-2">
            <RefreshCw className="h-4 w-4" /> Retry loading records
          </button>
        </section>
      ) : adminData ? (
        <>
          <section className="vault-card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4">
              <div>
                <h2 className="flex items-center gap-2 font-bold"><Building2 className="h-5 w-5 text-primary" /> Workshop applications</h2>
                <p className="mt-1 text-sm text-muted-foreground">Review pending garage and specialist registrations.</p>
              </div>
              <Pill tone={applications.length ? "warning" : "muted"}>{applications.length} pending</Pill>
            </div>
            {applications.length ? (
              <ul className="divide-y">
                {applications.map((application) => (
                  <li key={application.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{application.garage_name || application.full_name || "Workshop applicant"}</p>
                        <Pill>{application.workshop_type === "specialist" ? "Specialist" : "Garage"}</Pill>
                        {application.is_sample && <Pill>Sample record</Pill>}
                      </div>
                      <p className="mt-1 break-all text-sm text-muted-foreground">{application.email}</p>
                      {application.garage_registration && (
                        <p className="mt-1 text-xs text-muted-foreground">Registration: {application.garage_registration}</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn-ghost inline-flex items-center gap-1.5 border px-3 py-2 text-sm"
                        onClick={() => void reviewApplication(application, "rejected")}
                        disabled={reviewingId !== null}
                        aria-label={`Reject application from ${application.garage_name || application.email}`}
                      >
                        {reviewingId === application.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                        Reject
                      </button>
                      <button
                        type="button"
                        className="btn-primary inline-flex items-center gap-1.5 px-3 py-2 text-sm"
                        onClick={() => void reviewApplication(application, "approved")}
                        disabled={reviewingId !== null}
                      >
                        {reviewingId === application.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                        Approve
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<BadgeCheck className="h-5 w-5" />} title="No pending applications" detail="New garage and specialist applications will appear here." />
            )}
          </section>

          <section className="vault-card overflow-hidden">
            <div className="border-b p-4">
              <h2 className="flex items-center gap-2 font-bold"><BadgeCheck className="h-5 w-5 text-primary" /> Tier Overrides</h2>
              <p className="mt-1 text-sm text-muted-foreground">Grant or revoke lifetime Pro Modder / Collector access for a registered account.</p>
              <p className="mt-1 text-xs text-muted-foreground">Revoking removes the lifetime grant only; any separate active Stripe subscription remains unchanged.</p>
            </div>
            <div className="space-y-3 p-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">Search email or Clerk account ID</span>
                <input
                  className="field w-full"
                  type="search"
                  value={tierSearch}
                  onChange={(event) => setTierSearch(event.target.value)}
                  placeholder="name@example.com or user_..."
                  aria-label="Search registered users by email or account ID"
                />
              </label>
              {!tierSearch.trim() ? (
                <p className="text-sm text-muted-foreground">Search the registered account directory to manage an override.</p>
              ) : tierMatches.length ? (
                <ul className="divide-y rounded-xl border">
                  {tierMatches.map((user) => (
                    <li key={user.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center">
                      <div className="min-w-0 flex-1">
                        <p className="break-all text-sm font-semibold">{user.email}</p>
                        <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{user.id}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {user.tier_override === "pro_modder_lifetime" ? "Pro Modder / Collector · Lifetime · £0.00/mo" : "No lifetime tier override"}
                        </p>
                      </div>
                      <button
                        type="button"
                        className={user.tier_override === "pro_modder_lifetime"
                          ? "btn-ghost min-h-11 shrink-0 border border-red-500/40 px-3 text-sm text-red-200"
                          : "btn-primary min-h-11 shrink-0 px-3 text-sm"}
                        onClick={() => void changeTierOverride(user)}
                        disabled={adminActionId !== null}
                      >
                        {adminActionId === user.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                        {user.tier_override === "pro_modder_lifetime" ? "Revoke Access" : "Grant Lifetime Pro"}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">No registered account matches that email or account ID.</p>
              )}
            </div>
          </section>

          <section className="vault-card overflow-hidden">
            <div className="border-b p-4">
              <h2 className="flex items-center gap-2 font-bold"><Users className="h-5 w-5 text-primary" /> Registered users</h2>
              <p className="mt-1 text-sm text-muted-foreground">Linked vehicles are matched using the account owner ID.</p>
            </div>
            {users.length ? (
              <ul className="divide-y">
                {users.map((user) => {
                  const linkedVehicles = vehicles.filter((vehicle) => vehicle.owner_user_id === user.id);
                  return (
                    <li key={user.id} className="p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-semibold">{user.full_name || "Name not provided"}</p>
                            <Pill>{user.role.replaceAll("_", " ")}</Pill>
                            <Pill tone={user.status === "approved" ? "success" : user.status === "pending" ? "warning" : "muted"}>{user.status}</Pill>
                            {user.is_sample && <Pill>Sample record</Pill>}
                          </div>
                          <p className="mt-1 break-all text-sm text-muted-foreground">{user.email}</p>
                          {user.garage_name && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {user.garage_name}{user.garage_registration ? ` · ${user.garage_registration}` : ""}
                              {user.garage_verified ? " · Verified" : ""}
                            </p>
                          )}
                          {user.garage_name && (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <Pill tone={user.subscription_status === "trialing" ? "warning" : "muted"}>
                                {user.subscription_status === "trialing" && user.trial_expires_at
                                  ? `Trial ends ${formatDate(user.trial_expires_at)}`
                                  : `Workshop billing: ${user.subscription_status || "inactive"}`}
                              </Pill>
                              {user.role === "verified_garage" && user.status === "approved" && user.garage_verified && user.vat_verified && (
                                <button
                                  type="button"
                                  className="btn-ghost min-h-10 border px-3 py-1.5 text-xs"
                                  onClick={() => void extendTrial(user)}
                                  disabled={adminActionId !== null}
                                >
                                  {adminActionId === user.id ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Clock3 className="h-4 w-4" />}
                                  Grant 30-Day Trial Extension
                                </button>
                              )}
                            </div>
                          )}
                          <p className="mt-1 text-xs text-muted-foreground">Joined {formatDate(user.created_at)}</p>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <CarFront className="h-4 w-4" />
                          {linkedVehicles.length} {linkedVehicles.length === 1 ? "vehicle" : "vehicles"}
                        </div>
                      </div>
                      {linkedVehicles.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
                          {linkedVehicles.map((vehicle) => (
                            <span key={vehicle.vrm} className="inline-flex items-center gap-2 rounded-lg bg-muted/70 px-2.5 py-1.5 text-xs">
                              <Plate vrm={vehicle.vrm} size="sm" />
                              <span>{vehicle.make} {vehicle.model}</span>
                              {vehicle.is_sample && <span className="text-muted-foreground">Sample</span>}
                            </span>
                          ))}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState icon={<Users className="h-5 w-5" />} title="No registered users found" detail="Accounts will appear here when available." />
            )}
          </section>

          <section className="vault-card overflow-hidden">
            <div className="border-b p-4">
              <h2 className="flex items-center gap-2 font-bold"><Wrench className="h-5 w-5 text-primary" /> Vehicle records</h2>
              <p className="mt-1 text-sm text-muted-foreground">Correct make, model and odometer details. Unlinked records remain listed.</p>
            </div>
            {vehicles.length ? (
              <ul className="divide-y">
                {vehicles.map((vehicle) => {
                  const owner = users.find((user) => user.id === vehicle.owner_user_id);
                  const isEditing = editingVrm === vehicle.vrm;
                  return (
                    <li key={vehicle.vrm} className="p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <Plate vrm={vehicle.vrm} />
                          <div className="min-w-0">
                            <p className="font-semibold">{vehicle.make} {vehicle.model}</p>
                            <p className="text-xs text-muted-foreground">
                              {vehicle.odometerAvailable === false ? "Mileage not supplied" : `${vehicle.odometer.toLocaleString("en-GB")} miles`} · {owner ? `Owner: ${owner.full_name || owner.email}` : "Unlinked vehicle"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {vehicle.is_sample && <Pill>Sample record</Pill>}
                          <Pill>{vehicle.status}</Pill>
                          <button
                            type="button"
                            className="btn-ghost inline-flex items-center gap-1.5 border px-3 py-2 text-sm"
                            onClick={() => isEditing ? setEditingVrm(null) : startEditing(vehicle)}
                            aria-expanded={isEditing}
                            aria-controls={`edit-${encodeURIComponent(vehicle.vrm)}`}
                          >
                            {isEditing ? "Cancel" : "Edit"}
                            <ChevronDown className={`h-4 w-4 transition-transform ${isEditing ? "rotate-180" : ""}`} />
                          </button>
                        </div>
                      </div>
                      {isEditing && (
                        <form
                          id={`edit-${encodeURIComponent(vehicle.vrm)}`}
                          className="mt-4 grid gap-3 rounded-lg border bg-muted/30 p-3 sm:grid-cols-5"
                          onSubmit={(event) => void saveVehicle(event, vehicle.vrm)}
                        >
                          <label className="space-y-1">
                            <span className="text-xs font-semibold text-muted-foreground">Make</span>
                            <input className="field" value={draftMake} onChange={(event) => setDraftMake(event.target.value)} required />
                          </label>
                          <label className="space-y-1">
                            <span className="text-xs font-semibold text-muted-foreground">Model</span>
                            <input className="field" value={draftModel} onChange={(event) => setDraftModel(event.target.value)} required />
                          </label>
                          <label className="space-y-1">
                            <span className="text-xs font-semibold text-muted-foreground">Odometer (miles)</span>
                            <input className="field" type="number" min="0" step="1" value={draftOdometer} onChange={(event) => setDraftOdometer(event.target.value)} required />
                          </label>
                          <label className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm sm:items-center">
                            <input type="checkbox" checked={draftScrapped} onChange={(event) => setDraftScrapped(event.target.checked)} className="h-4 w-4 accent-cyan-400" />
                            <span>Scrapped / archive read-only</span>
                          </label>
                          <div className="flex items-end">
                            <button type="submit" className="btn-primary inline-flex w-full items-center justify-center gap-2 px-3 py-2" disabled={savingVrm !== null}>
                              {savingVrm === vehicle.vrm ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                              {savingVrm === vehicle.vrm ? "Saving…" : "Save vehicle"}
                            </button>
                          </div>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState icon={<CarFront className="h-5 w-5" />} title="No vehicle records found" detail="Registered vehicles will appear here." />
            )}
            {unlinkedVehicles.length > 0 && (
              <p className="border-t px-4 py-3 text-xs text-muted-foreground">
                {unlinkedVehicles.length} unlinked {unlinkedVehicles.length === 1 ? "vehicle is" : "vehicles are"} included above.
              </p>
            )}
          </section>

          {dataLoading && <p className="text-center text-xs text-muted-foreground">Refreshing records…</p>}
        </>
      ) : (
        <section className="vault-card p-5">
          <p className="text-sm text-muted-foreground">Admin records have not loaded yet.</p>
          <button type="button" onClick={refreshAdminData} className="btn-primary mt-4 inline-flex items-center gap-2">
            <RefreshCw className="h-4 w-4" /> Load records
          </button>
        </section>
      )}
    </div>
  );
}

function Summary({ icon, label, value }: { icon: ReactNode; label: string; value: number | null }) {
  return (
    <div className="vault-card flex items-center gap-3 p-4">
      <div className="rounded-lg bg-primary/15 p-2 text-primary">{icon}</div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="font-display text-2xl font-bold">{value === null ? "—" : value}</p>
      </div>
    </div>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="vault-card flex items-center gap-3 p-5" role="status">
      <div className="h-9 w-9 animate-pulse rounded-lg bg-primary/15" />
      <div className="space-y-2">
        <div className="h-3 w-36 animate-pulse rounded bg-muted" />
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function Notice({ title, message }: { title: string; message: string }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <div className="min-w-0">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 break-words text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return (
    <div className="flex flex-col items-center px-5 py-10 text-center">
      <div className="mb-3 rounded-full bg-muted p-3 text-muted-foreground">{icon}</div>
      <p className="font-semibold">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{detail}</p>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

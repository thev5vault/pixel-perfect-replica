import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { VaultProvider, useVault } from "@/lib/vault-store";
import { parseVehicleData } from "@/services/vehicle-data";
import { lookupMockRegistration, lookupRegistration } from "@/services/server/dvla";

describe("vehicle lookup data", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.stubEnv("GOV_API_ENABLED", "false");
    for (const key of ["DVSA_API_KEY", "DVSA_CLIENT_ID", "DVSA_CLIENT_SECRET", "DVSA_SCOPE_URL", "DVSA_TOKEN_URL", "DVLA_VES_API_KEY", "MOT_HISTORY_API_KEY", "MOT_HISTORY_CLIENT_ID", "MOT_HISTORY_CLIENT_SECRET", "MOT_HISTORY_TOKEN_URL"]) vi.stubEnv(key, "");
    localStorage.clear();
  });

  it("sorts history, converts kilometres, and retains defects without inventing missing data", () => {
    const vehicle = parseVehicleData("TEST123", { make: "VW", yearOfManufacture: 2018, fuelType: "Petrol" }, {
      model: "Golf", motTests: [
        { completedDate: "2025-01-02T10:00:00", testResult: "PASSED", expiryDate: "2026-01-01", odometerValue: "100000", odometerUnit: "KM", defects: [{ text: "Tyre wear", type: "ADVISORY" }] },
        { completedDate: "2024-01-02T10:00:00", testResult: "FAILED", odometerResultType: "UNREADABLE" },
      ],
    });
    expect(vehicle).toMatchObject({ model: "Golf", year: 2018, odometer: 62137, motStatus: "PASSED", motExpiry: "2026-01-01", source: "official" });
    expect(vehicle.motHistory?.[0]?.mileage).toBeUndefined();
    expect(vehicle.motHistory?.[1]?.advisories).toEqual(["ADVISORY: Tyre wear"]);
    expect(vehicle.odometerAvailable).toBe(true);
    expect(vehicle.engineCapacity).toBeUndefined();
    expect(parseVehicleData("TEST123", { make: "VW" }, {})).toMatchObject({ motExpiry: "", v5cDate: "", model: "Model unavailable", motHistory: [] });
  });

  it("hydrates DVSA engine capacity and binds all test readings as official history", () => {
    const vehicle = parseVehicleData("LG57VYF", {}, {
      make: "AUDI", model: "A4", engineSize: "2.0L", fuelType: "PETROL", primaryColour: "SILVER",
      motTests: [
        { completedDate: "2024-02-10T09:00:00", testResult: "FAILED", odometerValue: "108000", odometerUnit: "MI", odometerResultType: "READ", defects: [{ type: "MAJOR", text: "Brake pipe excessively corroded" }] },
        { completedDate: "2025-02-12T09:00:00", testResult: "PASSED", expiryDate: "2026-02-11", odometerValue: "112000", odometerUnit: "MI", odometerResultType: "READ", defects: [{ type: "ADVISORY", text: "Tyre worn close to legal limit" }] },
      ],
    });
    expect(vehicle).toMatchObject({
      odometer: 112000, odometerAvailable: true, engineCapacity: 2000, fuelType: "PETROL", colour: "SILVER",
      motHistorySource: "official", motHistory: [
        { date: "2024-02-10", result: "Fail", mileage: 108000, advisories: ["MAJOR: Brake pipe excessively corroded"] },
        { date: "2025-02-12", result: "Pass", mileage: 112000, advisories: ["ADVISORY: Tyre worn close to legal limit"] },
      ],
    });
  });

  it("provides explicit demo results only for sample plates", async () => {
    expect(await lookupRegistration("BUL200")).toMatchObject({ vehicle: { vrm: "BUL200", source: "demo" }, notice: expect.stringContaining("demo") });
    await expect(lookupRegistration("ZZ99ZZZ")).rejects.toThrow("Live lookup is not configured");
  });

  it("returns the exact supplied LG57 VYF specs without claiming they were live verified", () => {
    expect(lookupMockRegistration("lg57 vyf")).toMatchObject({
      vehicle: {
        vrm: "LG57VYF", make: "Audi", model: "A4", colour: "Silver", fuelType: "Petrol",
        registrationDate: "2007-09-17", motExpiry: "2027-02-16", vin: "WUAZZZ8EX8A800721",
        source: "user-provided", odometerAvailable: false,
      },
      notice: expect.stringContaining("unverified"),
    });
  });

  it("sanitizes OAuth environment values and logs Microsoft 401 diagnostics without credentials", async () => {
    const clientSecret = "test~.secret+with%&symbols";
    vi.stubEnv("DVSA_API_KEY", " ' api-key-test ' ");
    vi.stubEnv("DVSA_CLIENT_ID", "\" test-client \"");
    vi.stubEnv("DVSA_CLIENT_SECRET", `'  ${clientSecret}  '`);
    vi.stubEnv("DVSA_SCOPE_URL", "\" https://tapi.dvsa.gov.uk/.default \"");
    vi.stubEnv("DVSA_TOKEN_URL", "\" https://login.microsoftonline.com/test/oauth2/v2.0/token \"");
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: "invalid_client",
      error_description: `Client rejected secret ${clientSecret}`,
      error_codes: [7000215],
    }), { status: 401 }));
    vi.stubGlobal("fetch", fetcher);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(lookupRegistration("AB14CDE")).rejects.toThrow("DVSA authentication lookup failed (401)");

    expect(fetcher.mock.calls[0]?.[0]).toBe("https://login.microsoftonline.com/test/oauth2/v2.0/token");
    const params = new URLSearchParams(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(params.get("client_id")).toBe("test-client");
    expect(params.get("client_secret")).toBe(clientSecret);
    expect(params.get("scope")).toBe("https://tapi.dvsa.gov.uk/.default");
    const diagnostic = JSON.stringify(consoleError.mock.calls);
    expect(diagnostic).toContain("invalid_client");
    expect(diagnostic).toContain("7000215");
    expect(diagnostic).not.toContain(clientSecret);
    expect(diagnostic).not.toContain("api-key-test");
  });

  it("switches to manual entry for incomplete API credentials", async () => {
    vi.stubEnv("GOV_API_ENABLED", "true");
    vi.stubEnv("MOT_HISTORY_CLIENT_ID", "example-test-id");
    await expect(lookupRegistration("BUL200")).rejects.toThrow("DVSA Live Sync pending activation — manual service entry active");
  });

  it("posts normalized registration to VES and switches to manual entry on provider failure", async () => {
    vi.stubEnv("GOV_API_ENABLED", "true");
    vi.stubEnv("DVLA_VES_API_KEY", "test-key");
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ make: "AUDI", fuelType: "DIESEL", yearOfManufacture: 2014 })))
      .mockResolvedValueOnce(new Response("", { status: 503 }));
    vi.stubGlobal("fetch", fetcher);
    expect(await lookupRegistration("AB14CDE")).toMatchObject({ vehicle: { source: "official", make: "AUDI", motHistory: [] } });
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ method: "POST", body: '{"registrationNumber":"AB14CDE"}' });
    await expect(lookupRegistration("AB14CDE")).rejects.toThrow("DVSA Live Sync pending activation — manual service entry active");
  });

  it("uses DVSA MOT vehicle fields directly when DVLA VES is unavailable", async () => {
    vi.stubEnv("GOV_API_ENABLED", "true");
    vi.stubEnv("DVSA_API_KEY", "test-dvsa-key");
    vi.stubEnv("DVSA_CLIENT_ID", "test-client");
    const testSecret = "test-secret~.with+symbols%&";
    vi.stubEnv("DVSA_CLIENT_SECRET", testSecret);
    vi.stubEnv("DVSA_SCOPE_URL", "https://tapi.dvsa.gov.uk/.default");
    vi.stubEnv("DVSA_TOKEN_URL", "https://login.microsoftonline.com/test/oauth2/v2.0/token");
    vi.stubEnv("DVLA_VES_API_KEY", "unavailable-ves-test-key");
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "test-token", expires_in: 3600 })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
      make: "AUDI",
      model: "A4",
      firstUsedDate: "2007-09-17",
      fuelType: "Petrol",
      primaryColour: "Silver",
      vin: "WAUZZZ8K9EA000001",
      motTests: [{
        completedDate: "2025-02-17T00:00:00.000Z",
        testResult: "PASSED",
        expiryDate: "2026-02-16",
        odometerValue: "86420",
        odometerUnit: "MI",
        odometerResultType: "READ",
      }],
    })));
    vi.stubGlobal("fetch", fetcher);

    const result = await lookupRegistration("AB14 CDE");

    expect(result.vehicle).toMatchObject({
      make: "AUDI",
      model: "A4",
      registrationDate: "2007-09-17",
      colour: "Silver",
      fuelType: "Petrol",
      odometer: 86420,
      source: "official",
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(String(fetcher.mock.calls[1]?.[0])).toContain("/v1/trade/vehicles/registration/AB14CDE");
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    const tokenForm = new URLSearchParams(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(tokenForm.get("grant_type")).toBe("client_credentials");
    expect(tokenForm.get("client_id")).toBe("test-client");
    expect(tokenForm.get("client_secret")).toBe(testSecret);
    expect(tokenForm.get("scope")).toBe("https://tapi.dvsa.gov.uk/.default");
    expect(fetcher.mock.calls[1]?.[1]).toMatchObject({
      headers: {
        Authorization: "Bearer test-token",
        "X-API-Key": "test-dvsa-key",
        Accept: "application/json",
      },
    });
  });

  it("caches DVSA OAuth tokens and uses labelled fixture fallback when the live API is unavailable", async () => {
    vi.stubEnv("GOV_API_ENABLED", "true");
    vi.stubEnv("DVSA_API_KEY", "test-dvsa-key");
    vi.stubEnv("DVSA_CLIENT_ID", "test-client");
    vi.stubEnv("DVSA_CLIENT_SECRET", "test-secret");
    vi.stubEnv("DVSA_SCOPE_URL", "https://tapi.dvsa.gov.uk/.default");
    vi.stubEnv("DVSA_TOKEN_URL", "https://login.microsoftonline.com/test/oauth2/v2.0/token");
    vi.resetModules();
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "cached-token", expires_in: 3600 })))
      .mockResolvedValueOnce(new Response("", { status: 503 }));
    vi.stubGlobal("fetch", fetcher);
    const { lookupRegistration: freshLookup } = await import("@/services/server/dvla");

    const result = await freshLookup("AB14 CDE");
    expect(result.vehicle).toMatchObject({ source: "demo", vrm: "AB14CDE" });
    expect(result.notice).toContain("Live DVSA lookup was unavailable");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("keeps usable MOT vehicle details when the separate VES provider is down", async () => {
    vi.stubEnv("GOV_API_ENABLED", "true");
    vi.stubEnv("DVLA_VES_API_KEY", "test-ves-key");
    vi.stubEnv("MOT_HISTORY_API_KEY", "test-mot-key");
    vi.stubEnv("MOT_HISTORY_CLIENT_ID", "test-client");
    vi.stubEnv("MOT_HISTORY_CLIENT_SECRET", "test-secret");
    vi.stubEnv("MOT_HISTORY_TOKEN_URL", "https://login.microsoftonline.com/test/oauth2/v2.0/token");
    vi.resetModules();
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "test-token", expires_in: 3600 })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        make: "AUDI",
        model: "A4",
        primaryColour: "Silver",
        fuelType: "Petrol",
        motTests: [],
      })));
    vi.stubGlobal("fetch", fetcher);
    const { lookupRegistration: freshLookup } = await import("@/services/server/dvla");

    const result = await freshLookup("XY01ABC");

    expect(result.vehicle).toMatchObject({
      make: "AUDI",
      model: "A4",
      colour: "Silver",
      fuelType: "Petrol",
      source: "official",
    });
    expect(result.notice).toContain("DVLA VES is unavailable");
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it("obtains an MOT OAuth token and uses the API key on the official history request", async () => {
    vi.stubEnv("GOV_API_ENABLED", "true");
    vi.stubEnv("MOT_HISTORY_API_KEY", "test-api-key");
    vi.stubEnv("MOT_HISTORY_CLIENT_ID", "test-client");
    vi.stubEnv("MOT_HISTORY_CLIENT_SECRET", "test-secret");
    vi.stubEnv("MOT_HISTORY_TOKEN_URL", "https://login.microsoftonline.com/test/oauth2/v2.0/token");
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ access_token: "test-token", expires_in: 3600 })))
      .mockImplementation(async () => new Response(JSON.stringify({ make: "VW", model: "Golf", motTests: [] })));
    vi.stubGlobal("fetch", fetcher);
    expect(await lookupRegistration("BUL200")).toMatchObject({ vehicle: { source: "official", model: "Golf" } });
    expect(fetcher.mock.calls[1]?.[1]).toMatchObject({ headers: { Authorization: "Bearer test-token", "X-API-Key": "test-api-key" } });
    await lookupRegistration("BUL200");
    expect(fetcher).toHaveBeenCalledTimes(3); // Token reused for the second lookup.
  });

  it("attaches and persists a new vehicle without leaking the original MOT history", async () => {
    function Probe() {
      const { vehicle, vehicles, addVehicle } = useVault();
      return <><p>{vehicle.vrm} · {vehicle.motHistory?.length} tests · {vehicles.length} vehicles</p>
        <button onClick={() => addVehicle({ vrm: "BUL200", make: "VW", model: "Golf", odometer: 123, v5cDate: "", motExpiry: "", motHistory: [] })}>Attach</button></>;
    }
    const { unmount } = render(<VaultProvider><Probe /></VaultProvider>);
    fireEvent.click(screen.getByText("Attach"));
    expect(screen.getByText("BUL200 · 0 tests · 2 vehicles")).toBeInTheDocument();
    await waitFor(() => expect(JSON.parse(localStorage.getItem("v5vault:v1")!).vehicles).toHaveLength(2));
    unmount();
    render(<VaultProvider><Probe /></VaultProvider>);
    expect(await screen.findByText("BUL200 · 0 tests · 2 vehicles")).toBeInTheDocument();
  });
});

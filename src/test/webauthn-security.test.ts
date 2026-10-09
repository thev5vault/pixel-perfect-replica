import { describe, expect, it } from "vitest";
import { passkeySessionCookie, webAuthnRequestContext } from "@/services/server/webauthn";

function passkeyRequest(origin: string, requestUrl = `${origin}/api/passkeys`) {
  return new Request(requestUrl, {
    method: "POST",
    headers: {
      origin,
      host: new URL(requestUrl).host,
      "sec-fetch-site": "same-origin",
    },
  });
}

describe("native WebAuthn request security", () => {
  it("binds the RP ID and expected origin to the same secure site", () => {
    expect(webAuthnRequestContext(passkeyRequest("https://v5vault.example"))).toEqual({
      origin: "https://v5vault.example",
      rpId: "v5vault.example",
      secure: true,
    });
  });

  it("allows local HTTP only on loopback development origins", () => {
    expect(webAuthnRequestContext(passkeyRequest("http://localhost:5000"))).toMatchObject({
      origin: "http://localhost:5000",
      rpId: "localhost",
      secure: false,
    });
    expect(() => webAuthnRequestContext(passkeyRequest("http://v5vault.example"))).toThrow(/secure connection/i);
  });

  it("rejects cross-site origins even when a request claims another host", () => {
    expect(() => webAuthnRequestContext(passkeyRequest(
      "https://attacker.example",
      "https://v5vault.example/api/passkeys",
    ))).toThrow(/does not match/i);
    expect(() => webAuthnRequestContext(new Request("https://v5vault.example/api/passkeys", {
      method: "POST",
      headers: { origin: "https://v5vault.example", host: "v5vault.example", "sec-fetch-site": "cross-site" },
    }))).toThrow(/cross-site/i);
  });

  it("uses an HttpOnly, same-site, path-wide cookie and only adds Secure on HTTPS", () => {
    expect(passkeySessionCookie("secret-token", true)).toContain("Path=/; HttpOnly; SameSite=Lax");
    expect(passkeySessionCookie("secret-token", true)).toContain("; Secure");
    expect(passkeySessionCookie("secret-token", false)).not.toContain("Secure");
  });
});

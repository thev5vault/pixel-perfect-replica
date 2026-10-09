import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ request: vi.fn() }));
import { createClerkProxyHandler, clerkProxyMiddleware, CLERK_PROXY_PATH } from "../../server/middlewares/clerkProxyMiddleware";

describe("Clerk proxy middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rewrites the path, forwards Clerk proxy headers, and buffers unknown-length responses", async () => {
    vi.stubEnv("NODE_ENV", "production");
    let proxyResponse!: Readable & { statusCode: number; headers: Record<string, string> };
    mocks.request.mockImplementation((_target, options, callback) => {
      proxyResponse = Readable.from([Buffer.from("upstream-ok")]) as typeof proxyResponse;
      proxyResponse.statusCode = 200;
      proxyResponse.headers = { "content-type": "text/plain", "transfer-encoding": "chunked", connection: "keep-alive" };
      callback(proxyResponse);
      const request = new EventEmitter() as EventEmitter & { destroy: ReturnType<typeof vi.fn> };
      request.destroy = vi.fn();
      return request;
    });
    const middleware = createClerkProxyHandler("test-only-secret", mocks.request as never);
    const req = Object.assign(new EventEmitter(), {
      method: "GET",
      url: `${CLERK_PROXY_PATH}/v1/client?__clerk_api_version=2025-01-01`,
      originalUrl: `${CLERK_PROXY_PATH}/v1/client?__clerk_api_version=2025-01-01`,
      headers: { host: "internal.replit", "x-forwarded-host": "vault.replit.dev", "x-forwarded-proto": "https" },
      socket: { remoteAddress: "192.0.2.4" },
      pipe: (destination: unknown) => destination,
    });
    const res = Object.assign(new EventEmitter(), {
      headersSent: false,
      writableEnded: false,
      writeHead: vi.fn(function (this: { headersSent: boolean }, _status: number, headers: Record<string, string>) {
        this.headersSent = true;
        expect(headers["content-length"]).toBe("11");
        expect(headers["connection"]).toBeUndefined();
        expect(headers["transfer-encoding"]).toBeUndefined();
      }),
      end: vi.fn(function (this: { writableEnded: boolean }, body: Buffer) {
        this.writableEnded = true;
        expect(body.toString()).toBe("upstream-ok");
      }),
      destroy: vi.fn(),
    });
    middleware(req as never, res as never, vi.fn());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(mocks.request).toHaveBeenCalledWith(
      expect.objectContaining({ hostname: "frontend-api.clerk.dev" }),
      expect.objectContaining({
        method: "GET",
        path: "/v1/client?__clerk_api_version=2025-01-01",
        headers: expect.objectContaining({
          "Clerk-Proxy-Url": `https://vault.replit.dev${CLERK_PROXY_PATH}`,
          "Clerk-Secret-Key": "test-only-secret",
          "X-Forwarded-For": "192.0.2.4",
        }),
      }),
      expect.any(Function),
    );
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(res.end).toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("passes through unchanged outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const next = vi.fn();
    clerkProxyMiddleware()({} as never, {} as never, next);
    expect(next).toHaveBeenCalledOnce();
    expect(mocks.request).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});

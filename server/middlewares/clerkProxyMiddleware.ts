/**
 * Clerk Frontend API Proxy Middleware
 *
 * Proxies Clerk Frontend API requests through your domain, enabling Clerk
 * authentication on custom domains and .replit.app deployments without
 * requiring CNAME DNS configuration.
 *
 * AUTH CONFIGURATION: To manage users, enable/disable login providers
 * (Google, GitHub, etc.), change app branding, or configure OAuth credentials,
 * use the Auth pane in the workspace toolbar. There is no external Clerk
 * dashboard — all auth configuration is done through the Auth pane.
 *
 * IMPORTANT:
 * - Only active in production (Clerk proxying doesn't work for dev instances)
 * - Must be mounted BEFORE express.json() middleware
 *
 * Usage in app.ts:
 *   import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
 *   app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());
 */

import type { IncomingHttpHeaders } from 'http';
import type { RequestHandler } from 'express';
import { request as httpsRequest } from 'node:https';

const CLERK_FAPI = 'https://frontend-api.clerk.dev';
export const CLERK_PROXY_PATH = '/api/__clerk';

/**
 * Returns the first effective public hostname for the given request,
 * preferring x-forwarded-host over the Host header so callers behind a
 * proxy see the original client-facing host.
 *
 * x-forwarded-host can take three shapes:
 *   - undefined (no proxy involved)
 *   - a single string (one proxy hop)
 *   - a comma-delimited string when an upstream appended rather than
 *     replaced the header (Node folds duplicate headers this way), or a
 *     string[] in some Express typings
 * In the multi-value case, the leftmost value is the original client-
 * facing host. Take that one in all forms. Exported so that app.ts
 * (clerkMiddleware callback) and this proxy middleware agree on which
 * hostname is canonical — otherwise multi-domain/custom-domain flows
 * break.
 */
export function getClerkProxyHost(req: {
  headers: IncomingHttpHeaders;
}): string | undefined {
  const forwarded = req.headers['x-forwarded-host'];
  const raw = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  const firstHop = raw?.split(',')[0]?.trim();
  return firstHop || req.headers.host?.trim() || undefined;
}

export function clerkProxyMiddleware(): RequestHandler {
  // Only run proxy in production — Clerk proxying doesn't work for dev instances
  if (process.env.NODE_ENV !== 'production') {
    return (_req, _res, next) => next();
  }

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    return (_req, _res, next) => next();
  }

  const target = new URL(CLERK_FAPI);
  return (req, res, next) => {
    const originalUrl = req.originalUrl || req.url || '/';
    const path = originalUrl.startsWith(CLERK_PROXY_PATH)
      ? originalUrl.slice(CLERK_PROXY_PATH.length) || '/'
      : req.url || '/';
    const headers = { ...req.headers };
    delete headers.host;
    delete headers.connection;
    delete headers['proxy-connection'];
    headers.host = target.host;
    const protocolHeader = req.headers['x-forwarded-proto'];
    const protocol = (Array.isArray(protocolHeader) ? protocolHeader[0] : protocolHeader)?.split(',')[0]?.trim() || 'https';
    const host = getClerkProxyHost(req) || '';
    headers['Clerk-Proxy-Url'] = `${protocol}://${host}${CLERK_PROXY_PATH}`;
    headers['Clerk-Secret-Key'] = secretKey;
    const forwardedFor = req.headers['x-forwarded-for'];
    const clientIp = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)?.split(',')[0]?.trim()
      || req.socket.remoteAddress;
    if (clientIp) headers['X-Forwarded-For'] = clientIp;

    const upstream = httpsRequest(target, { method: req.method, path, headers }, (upstreamResponse) => {
      const responseHeaders = { ...upstreamResponse.headers };
      delete responseHeaders['transfer-encoding'];
      delete responseHeaders.connection;
      delete responseHeaders['keep-alive'];
      const status = upstreamResponse.statusCode ?? 502;
      if (status < 200 || status === 204) delete responseHeaders['content-length'];
      const bodyless = req.method === 'HEAD' || status < 200 || status === 204 || status === 304;
      if (responseHeaders['content-length'] !== undefined || bodyless) {
        res.writeHead(status, responseHeaders);
        upstreamResponse.on('error', () => res.destroy());
        upstreamResponse.pipe(res);
        return;
      }
      const chunks: Buffer[] = [];
      upstreamResponse.on('data', (chunk: Buffer) => chunks.push(chunk));
      upstreamResponse.on('end', () => {
        const body = Buffer.concat(chunks);
        responseHeaders['content-length'] = String(body.length);
        res.writeHead(status, responseHeaders);
        res.end(body);
      });
      upstreamResponse.on('error', () => {
        if (!res.headersSent) res.writeHead(502, { 'content-length': '0' });
        res.end();
      });
    });
    upstream.on('error', () => {
      if (!res.headersSent) res.writeHead(502, { 'content-length': '0' });
      res.end();
    });
    req.on('aborted', () => upstream.destroy());
    res.on('close', () => { if (!res.writableEnded) upstream.destroy(); });
    req.pipe(upstream);
  };
}

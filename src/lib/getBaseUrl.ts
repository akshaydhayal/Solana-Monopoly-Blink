import { NextRequest } from "next/server";

/**
 * Derive the canonical base URL for generating callback hrefs.
 *
 * Priority order:
 *   1. NEXT_PUBLIC_APP_URL env var (set in Vercel project settings)
 *   2. x-forwarded-host + x-forwarded-proto headers (set by Vercel/proxies)
 *   3. The 'host' header from the incoming request
 *
 * This ensures that the callback href is ALWAYS pointing to the same server
 * that received the request, never to localhost unless actually running locally.
 */
export function getBaseUrl(req: NextRequest): string {
  // 1. Explicit env override (must be set in Vercel env settings, not .env.local)
  const envUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (envUrl && !envUrl.includes("localhost")) {
    return envUrl.replace(/\/$/, "");
  }

  // 2. Use forwarded headers (from Vercel, ngrok, etc.)
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const forwardedHost = req.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const proto = forwardedProto || "https";
    return `${proto}://${forwardedHost}`;
  }

  // 3. Derive from the request URL itself
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

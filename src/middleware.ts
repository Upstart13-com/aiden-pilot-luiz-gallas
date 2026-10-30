import { securityHeaders } from "@upstart13-com/aiden-security/middleware";

const isDev = process.env.NODE_ENV !== "production";

/**
 * Next's dev server needs `unsafe-eval` for fast refresh, inline scripts for
 * the hydration bootstrap, and a websocket for HMR — none of which the
 * package's default CSP allows. Production keeps that strict default
 * untouched; only local development is relaxed.
 */
const DEV_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
  "connect-src 'self' ws: wss:",
  "object-src 'none'",
].join("; ");

export const middleware = securityHeaders({
  csp: isDev ? DEV_CSP : undefined,
  // HSTS on plain-HTTP localhost would pin the browser to https://localhost
  // for two years, breaking local dev well beyond this project.
  hsts: isDev ? false : undefined,
});

export const config = {
  // Skip Next's own static output — the headers matter on documents and API
  // responses, and running middleware on every asset is wasted work.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

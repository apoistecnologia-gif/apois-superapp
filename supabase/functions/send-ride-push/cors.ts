/**
 * APOIS Edge Function CORS Helper
 * 
 * Provides strict origin validation for browser-callable functions.
 * Webhooks (like Mercado Pago) do not require browser CORS as they are server-to-server;
 * their protection is signature validation, not CORS.
 */

const ENVIRONMENT =
  Deno.env.get("APP_ENV") ??
  Deno.env.get("ENVIRONMENT") ??
  "production";

const ALLOWED_METHODS = "POST, OPTIONS";
const ALLOWED_HEADERS = "authorization, x-client-info, apikey, content-type, x-signature, x-request-id";

/**
 * getCorsHeaders(request)
 * 
 * Implements least-privilege CORS logic.
 * - Exact origin matching via ALLOWED_ORIGINS secret.
 * - Localhost support restricted to development environment.
 * - Omission of Access-Control-Allow-Origin for unknown origins.
 * - Support for Capacitor/Server-to-Server (no Origin header).
 */
export function getCorsHeaders(request: Request) {
  const origin = request.headers.get("Origin");
  const allowedOriginsStr = Deno.env.get("ALLOWED_ORIGINS") || "";
  const allowedOrigins = allowedOriginsStr
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);

  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": ALLOWED_METHODS,
    "Vary": "Origin",
  };

  // 1. Capacitor/Server-to-Server: Omit ACAO if no Origin header
  if (!origin) {
    return headers;
  }

  let isAllowed = false;

  try {
    const url = new URL(origin);
    
    // 2. Localhost Restriction: Only in development
    const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (isLocalhost) {
      if (ENVIRONMENT === "development") {
        isAllowed = true;
      }
    } else {
      // 3. Exact Origin Matching
      isAllowed = allowedOrigins.includes(origin);
      
      // 4. HTTPS Requirement: Enforced outside development
      if (isAllowed && ENVIRONMENT !== "development" && url.protocol !== "https:") {
        isAllowed = false;
      }
    }
  } catch {
    // Invalid URL syntax in Origin header
    isAllowed = false;
  }

  // 5. Return exact origin only if validated
  if (isAllowed) {
    headers["Access-Control-Allow-Origin"] = origin;
  }

  return headers;
}

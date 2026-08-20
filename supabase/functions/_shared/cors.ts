/** Shared CORS policy for APOIS Edge Functions used by Web/Capacitor clients. */
const ENVIRONMENT = Deno.env.get("APP_ENV") ?? Deno.env.get("ENVIRONMENT") ?? "production";
const NATIVE_ORIGINS = new Set(["https://localhost", "capacitor://localhost", "ionic://localhost"]);

export function getCorsHeaders(request: Request): Record<string, string> {
  const originHeader = request.headers.get("Origin");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-signature, x-request-id",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
  if (!originHeader) return headers;

  const origin = originHeader.replace(/\/$/, "");
  const configured = new Set(
    (Deno.env.get("ALLOWED_ORIGINS") ?? "")
      .split(",")
      .map((value) => value.trim().replace(/\/$/, ""))
      .filter(Boolean),
  );
  let allowed = NATIVE_ORIGINS.has(origin) || configured.has(origin);
  try {
    const url = new URL(origin);
    if (ENVIRONMENT === "development" && (url.hostname === "localhost" || url.hostname === "127.0.0.1")) allowed = true;
    if (allowed && ENVIRONMENT !== "development" && !NATIVE_ORIGINS.has(origin)) allowed = url.protocol === "https:";
  } catch {
    allowed = false;
  }
  if (allowed) headers["Access-Control-Allow-Origin"] = originHeader;
  return headers;
}

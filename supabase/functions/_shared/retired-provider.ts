const HEADERS: Record<string, string> = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, x-client-info, apikey, content-type, x-signature, x-webhook-signature",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
};

export type RetiredClassification =
  | "RETIRED_FAIL_CLOSED"
  | "WEBHOOK_RETIRED"
  | "OAUTH_RETIRED";

export function retiredProvider(req: Request, functionName: string, classification: RetiredClassification = "RETIRED_FAIL_CLOSED"): Response {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: HEADERS });
  return new Response(JSON.stringify({
    ok: false,
    error: "provider_retired",
    code: "PROVIDER_RETIRED",
    function: functionName,
    classification,
    message: "Esta integração financeira foi aposentada e não pode produzir novos efeitos.",
  }), { status: 410, headers: HEADERS });
}
